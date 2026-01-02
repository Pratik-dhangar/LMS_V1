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
                rightMargin=0.6*inch,
                leftMargin=0.6*inch,
                topMargin=0.6*inch,
                bottomMargin=0.6*inch
            )
            
            # Container for PDF elements
            elements = []
            
            # Get styles
            styles = getSampleStyleSheet()
            
            # Define custom styles
            company_title_style = ParagraphStyle(
                'CompanyTitle',
                parent=styles['Heading1'],
                fontSize=28,
                textColor=colors.HexColor('#41A67E'),
                spaceAfter=2,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            
            company_subtitle_style = ParagraphStyle(
                'CompanySubtitle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#7f8c8d'),
                spaceAfter=12,
                alignment=TA_CENTER,
                fontName='Helvetica'
            )
            
            section_heading_style = ParagraphStyle(
                'SectionHeading',
                parent=styles['Heading2'],
                fontSize=11,
                textColor=colors.HexColor('#41A67E'),
                spaceAfter=10,
                spaceBefore=10,
                fontName='Helvetica-Bold',
                borderColor=colors.HexColor('#41A67E'),
                borderWidth=1,
                borderPadding=5,
                borderRadius=2
            )
            
            label_style = ParagraphStyle(
                'Label',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#7f8c8d'),
                spaceAfter=2,
                fontName='Helvetica-Bold'
            )
            
            normal_style = ParagraphStyle(
                'Normal',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#2c3e50'),
                spaceAfter=4,
                fontName='Helvetica'
            )
            
            footer_style = ParagraphStyle(
                'Footer',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#95a5a6'),
                alignment=TA_CENTER,
                fontName='Helvetica'
            )
            
            # ===== HEADER SECTION =====
            # Company name and subtitle
            elements.append(Paragraph(self.company_name, company_title_style))
            elements.append(Paragraph("Professional Learning Materials", company_subtitle_style))
            
            # Decorative line
            from reportlab.platypus import HRFlowable
            elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#41A67E'), spaceAfter=15))
            
            # Invoice header info (3 columns)
            invoice_header_data = [
                [
                    Paragraph(f"<b>Invoice Number</b><br/>{invoice_number}", label_style),
                    Paragraph(f"<b>Order Number</b><br/>{order_number}", label_style),
                    Paragraph(f"<b>Invoice Date</b><br/>{created_at.strftime('%d-%m-%Y')}", label_style),
                ]
            ]
            invoice_header_table = Table(invoice_header_data, colWidths=[2.1*inch, 2.1*inch, 2.1*inch])
            invoice_header_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0f8f5')),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('BORDER', (0, 0), (-1, -1), 1, colors.HexColor('#d5e8e4')),
                ('BORDERRADIUS', (0, 0), (-1, -1), 5),
            ]))
            elements.append(invoice_header_table)
            elements.append(Spacer(1, 0.25*inch))
            
            # ===== BILLING & SHIPPING INFO =====
            # Two column layout for Bill To and Ship To
            bill_ship_data = [
                [
                    Paragraph("<b>BILL TO</b>", section_heading_style),
                    Paragraph("<b>SHIP TO</b>", section_heading_style),
                ],
                [
                    Paragraph(f"<b>{customer_name}</b><br/>{customer_email}", normal_style),
                    Paragraph(f"<b>{customer_name}</b><br/>{delivery_address}, {delivery_city}<br/>Postal Code: {delivery_pincode}", normal_style),
                ]
            ]
            bill_ship_table = Table(bill_ship_data, colWidths=[3.3*inch, 3.3*inch])
            bill_ship_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('TOPPADDING', (0, 1), (-1, -1), 10),
                ('LEFTPADDING', (0, 1), (-1, -1), 0),
                ('RIGHTPADDING', (0, 1), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
            ]))
            elements.append(bill_ship_table)
            elements.append(Spacer(1, 0.2*inch))
            
            # ===== LINE ITEMS TABLE =====
            items_data = [['Product', 'Qty', 'Unit Price', 'Amount']]
            for item in order_items:
                items_data.append([
                    item['product_name'][:30],  # Limit product name length
                    str(item['quantity']),
                    f"₹{float(item['unit_price']):.2f}",
                    f"₹{float(item['line_total']):.2f}"
                ])
            
            items_table = Table(
                items_data,
                colWidths=[3.2*inch, 0.8*inch, 1.2*inch, 1.2*inch]
            )
            items_table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#41A67E')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                
                # Body styling
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ffffff')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#2c3e50')),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('TOPPADDING', (0, 1), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
                ('LEFTPADDING', (0, 1), (-1, -1), 8),
                ('RIGHTPADDING', (0, 1), (-1, -1), 8),
                
                # Grid styling
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e0e0e0')),
                ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#41A67E')),
                ('LINEBELOW', (0, -1), (-1, -1), 2, colors.HexColor('#41A67E')),
            ]))
            elements.append(items_table)
            elements.append(Spacer(1, 0.15*inch))
            
            # ===== TOTALS SECTION =====
            # Right-aligned totals
            totals_data = [
                ['Subtotal', f"₹{float(subtotal):.2f}"],
                ['Discount', f"-₹{float(discount_total):.2f}"],
                ['', ''],  # Spacer row
                ['TOTAL AMOUNT DUE', f"₹{float(total_amount):.2f}"]
            ]
            
            totals_table = Table(
                totals_data,
                colWidths=[4.5*inch, 1.4*inch]
            )
            totals_table.setStyle(TableStyle([
                # Subtotal and Discount rows
                ('ALIGN', (0, 0), (0, 1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, 1), 'RIGHT'),
                ('FONTNAME', (0, 0), (0, 1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (0, 1), 10),
                ('TEXTCOLOR', (0, 0), (0, 1), colors.HexColor('#2c3e50')),
                ('TOPPADDING', (0, 0), (1, 1), 8),
                ('BOTTOMPADDING', (0, 0), (1, 1), 8),
                ('RIGHTPADDING', (0, 0), (-1, 1), 12),
                ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor('#ffffff')),
                
                # Spacer row
                ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#ffffff')),
                ('TOPPADDING', (0, 2), (-1, 2), 4),
                ('BOTTOMPADDING', (0, 2), (-1, 2), 4),
                
                # Total row
                ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#41A67E')),
                ('TEXTCOLOR', (0, 3), (-1, 3), colors.whitesmoke),
                ('ALIGN', (0, 3), (0, 3), 'RIGHT'),
                ('ALIGN', (1, 3), (1, 3), 'RIGHT'),
                ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 3), (-1, 3), 13),
                ('TOPPADDING', (0, 3), (-1, 3), 12),
                ('BOTTOMPADDING', (0, 3), (-1, 3), 12),
                ('RIGHTPADDING', (0, 3), (-1, 3), 12),
                ('LEFTPADDING', (0, 3), (-1, 3), 12),
                
                # Borders
                ('LINEABOVE', (0, 3), (-1, 3), 2, colors.HexColor('#41A67E')),
                ('LINEBELOW', (0, 3), (-1, 3), 2, colors.HexColor('#41A67E')),
            ]))
            
            # Right-align the totals table
            totals_wrapper_data = [['', totals_table]]
            totals_wrapper = Table(totals_wrapper_data, colWidths=[3.3*inch, 2.4*inch])
            totals_wrapper.setStyle(TableStyle([('ALIGN', (1, 0), (1, 0), 'RIGHT')]))
            elements.append(totals_wrapper)
            elements.append(Spacer(1, 0.25*inch))
            
            # ===== FOOTER SECTION =====
            elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0'), spaceAfter=10))
            
            footer_text = f"Thank you for your business! | Invoice: {invoice_number} | Generated: {datetime.utcnow().strftime('%d-%m-%Y %H:%M:%S')} | HurshBintech © 2025"
            elements.append(Paragraph(footer_text, footer_style))
            
            # Build PDF
            doc.build(elements)
            pdf_bytes = pdf_buffer.getvalue()
            
            # Upload to S3 or local storage
            year = created_at.year
            invoice_path = self._save_invoice(
                pdf_bytes=pdf_bytes,
                order_id=order_id,
                invoice_number=invoice_number,
                year=year
            )
            
            logger.info(f"Generated and saved invoice {invoice_number} for order {order_number}")
            return pdf_bytes, invoice_path
            
        except Exception as e:
            logger.error(f"Error generating invoice PDF: {str(e)}")
            raise
    
    def _save_invoice(
        self,
        pdf_bytes: bytes,
        order_id: str,
        invoice_number: str,
        year: int
    ) -> str:
        """
        Save invoice PDF to S3 (production) or local storage (development)
        
        Args:
            pdf_bytes: PDF file bytes
            order_id: Order UUID
            invoice_number: Invoice number
            year: Year for folder organization
        
        Returns:
            str: Path to the saved invoice (S3 path or local file path)
        """
        try:
            filename = f"{invoice_number}.pdf"
            folder = f"invoices/{year}/{order_id}"
            
            if settings.USE_S3:
                # Production: Upload to S3
                s3_path = self.s3_manager.upload_file(
                    file_content=pdf_bytes,
                    folder=folder,
                    filename=filename,
                    content_type="application/pdf"
                )
                logger.info(f"Invoice uploaded to S3: {s3_path}")
                return s3_path
            else:
                # Development: Save to local file system
                import os
                
                # Create directory structure: uploads/invoices/{year}/{order_id}/
                local_dir = os.path.join("uploads", folder)
                os.makedirs(local_dir, exist_ok=True)
                
                # Save file
                file_path = os.path.join(local_dir, filename)
                with open(file_path, 'wb') as f:
                    f.write(pdf_bytes)
                
                # Return relative path for consistency with S3 (invoices/2025/order-id/INV-2025-000001.pdf)
                # Use forward slashes for consistency across platforms
                relative_path = f"{folder}/{filename}".replace("\\", "/")
                logger.info(f"Invoice saved to local storage: {file_path}")
                logger.info(f"Returning invoice path: {relative_path}")
                return relative_path
            
        except Exception as e:
            logger.error(f"Error saving invoice: {str(e)}")
            raise
    
    def _upload_invoice_to_s3(
        self,
        pdf_bytes: bytes,
        order_id: str,
        invoice_number: str,
        year: int
    ) -> str:
        """
        DEPRECATED: Use _save_invoice instead
        Upload invoice PDF to S3
        
        Args:
            pdf_bytes: PDF file bytes
            order_id: Order UUID
            invoice_number: Invoice number
            year: Year for folder organization
        
        Returns:
            str: S3 path to the uploaded invoice
        """
        return self._save_invoice(pdf_bytes, order_id, invoice_number, year)
