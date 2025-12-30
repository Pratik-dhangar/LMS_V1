"""Invoice PDF Generation Service using ReportLab"""
import io
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from app.core.config import settings
from app.utils.s3_utils import S3Manager

logger = logging.getLogger(__name__)


class InvoiceGenerator:
    """Generate PDF invoices for orders"""
    
    def __init__(self):
        self.s3_manager = S3Manager(
            bucket_name=settings.S3_BUCKET_NAME,
            region=settings.AWS_REGION
        )
        self.page_size = A4
        self.company_name = "HurshBintech"
        self.company_address = "India"
    
    def generate_invoice_pdf(
        self,
        order_id: str,
        order_number: str,
        invoice_number: str,
        customer_name: str,
        customer_email: str,
        delivery_address: str,
        delivery_city: str,
        delivery_pincode: str,
        order_items: List[dict],
        subtotal: Decimal,
        discount_total: Decimal,
        total_amount: Decimal,
        created_at: datetime
    ) -> tuple:
        """
        Generate a PDF invoice and upload to S3
        
        Args:
            order_id: UUID of the order
            order_number: Order number (e.g., ORD-2025-001234)
            invoice_number: Invoice number (e.g., INV-2025-000001)
            customer_name: Full name of customer
            customer_email: Email of customer
            delivery_address: Delivery address
            delivery_city: City name
            delivery_pincode: Postal code
            order_items: List of dicts with product_name, quantity, unit_price, line_total
            subtotal: Order subtotal
            discount_total: Total discount amount
            total_amount: Final amount to be paid
            created_at: Order creation datetime
        
        Returns:
            tuple: (pdf_bytes, s3_path)
        """
        try:
            # Create PDF in memory
            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer,
                pagesize=self.page_size,
                rightMargin=0.5*inch,
                leftMargin=0.5*inch,
                topMargin=0.5*inch,
                bottomMargin=0.5*inch
            )
            
            # Container for PDF elements
            elements = []
            
            # Get styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#41A67E'),
                spaceAfter=6,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            
            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=12,
                textColor=colors.HexColor('#2c3e50'),
                spaceAfter=6,
                fontName='Helvetica-Bold'
            )
            
            normal_style = ParagraphStyle(
                'CustomNormal',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#333333'),
                spaceAfter=4
            )
            
            # Header
            elements.append(Paragraph(self.company_name, title_style))
            elements.append(Spacer(1, 0.1*inch))
            
            # Invoice and Order Info
            info_data = [
                [
                    f"<b>Invoice No:</b> {invoice_number}",
                    f"<b>Order No:</b> {order_number}",
                    f"<b>Date:</b> {created_at.strftime('%d-%m-%Y')}"
                ]
            ]
            info_table = Table(info_data, colWidths=[2*inch, 2*inch, 2*inch])
            info_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0f4ff')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#333333')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
            ]))
            elements.append(info_table)
            elements.append(Spacer(1, 0.15*inch))
            
            # Customer Details
            elements.append(Paragraph("<b>Bill To:</b>", heading_style))
            customer_details = [
                f"<b>Name:</b> {customer_name}",
                f"<b>Email:</b> {customer_email}",
                f"<b>Address:</b> {delivery_address}, {delivery_city} - {delivery_pincode}"
            ]
            for detail in customer_details:
                elements.append(Paragraph(detail, normal_style))
            elements.append(Spacer(1, 0.15*inch))
            
            # Order Items Table
            items_data = [['Product Name', 'Qty', 'Unit Price', 'Line Total']]
            for item in order_items:
                items_data.append([
                    item['product_name'],
                    str(item['quantity']),
                    f"₹{float(item['unit_price']):.2f}",
                    f"₹{float(item['line_total']):.2f}"
                ])
            
            items_table = Table(
                items_data,
                colWidths=[3*inch, 0.8*inch, 1*inch, 1.2*inch]
            )
            items_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#41A67E')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')])
            ]))
            elements.append(items_table)
            elements.append(Spacer(1, 0.15*inch))
            
            # Totals Section
            totals_data = [
                ['Subtotal', '', '', f"₹{float(subtotal):.2f}"],
                ['Discount', '', '', f"₹{float(discount_total):.2f}"],
                ['TOTAL', '', '', f"₹{float(total_amount):.2f}"]
            ]
            
            totals_table = Table(
                totals_data,
                colWidths=[3*inch, 0.8*inch, 1*inch, 1.2*inch]
            )
            totals_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (2, -1), 'RIGHT'),
                ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, 1), 9),
                ('FONTNAME', (0, 2), (-1, 2), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 2), (-1, 2), 12),
                ('TEXTCOLOR', (0, 2), (-1, 2), colors.whitesmoke),
                ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#41A67E')),
                ('TOPPADDING', (0, 2), (-1, 2), 10),
                ('BOTTOMPADDING', (0, 2), (-1, 2), 10),
                ('GRID', (2, 0), (-1, -1), 0.5, colors.grey)
            ]))
            elements.append(totals_table)
            elements.append(Spacer(1, 0.2*inch))
            
            # Footer
            footer_style = ParagraphStyle(
                'CustomFooter',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#9ca3af'),
                alignment=TA_CENTER
            )
            elements.append(Paragraph(
                f"Thank you for your order! | Invoice generated on {datetime.utcnow().strftime('%d-%m-%Y %H:%M:%S')}",
                footer_style
            ))
            
            # Build PDF
            doc.build(elements)
            pdf_bytes = pdf_buffer.getvalue()
            
            # Upload to S3
            year = created_at.year
            s3_path = self._upload_invoice_to_s3(
                pdf_bytes=pdf_bytes,
                order_id=order_id,
                invoice_number=invoice_number,
                year=year
            )
            
            logger.info(f"Generated and uploaded invoice {invoice_number} for order {order_number}")
            return pdf_bytes, s3_path
            
        except Exception as e:
            logger.error(f"Error generating invoice PDF: {str(e)}")
            raise
    
    def _upload_invoice_to_s3(
        self,
        pdf_bytes: bytes,
        order_id: str,
        invoice_number: str,
        year: int
    ) -> str:
        """
        Upload invoice PDF to S3
        
        Args:
            pdf_bytes: PDF file bytes
            order_id: Order UUID
            invoice_number: Invoice number
            year: Year for folder organization
        
        Returns:
            str: S3 path to the uploaded invoice
        """
        try:
            filename = f"{invoice_number}.pdf"
            folder = f"invoices/{year}/{order_id}"
            
            s3_path = self.s3_manager.upload_file(
                file_content=pdf_bytes,
                folder=folder,
                filename=filename,
                content_type="application/pdf"
            )
            
            logger.info(f"Invoice uploaded to S3: {s3_path}")
            return s3_path
            
        except Exception as e:
            logger.error(f"Error uploading invoice to S3: {str(e)}")
            raise
