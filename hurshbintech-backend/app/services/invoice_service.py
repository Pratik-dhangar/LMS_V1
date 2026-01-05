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
        self.company_name = "HurshBinTech"
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
            company_logo_style = ParagraphStyle(
                'CompanyLogo',
                parent=styles['Normal'],
                fontSize=14,
                textColor=colors.HexColor('#333333'),
                spaceAfter=2,
                alignment=TA_RIGHT,
                fontName='Helvetica-Bold'
            )
            
            company_address_style = ParagraphStyle(
                'CompanyAddress',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#666666'),
                spaceAfter=15,
                alignment=TA_RIGHT,
                fontName='Helvetica'
            )
            
            invoice_title_style = ParagraphStyle(
                'InvoiceTitle',
                parent=styles['Heading1'],
                fontSize=40,
                textColor=colors.HexColor('#000000'),
                spaceAfter=20,
                alignment=TA_LEFT,
                fontName='Helvetica-Bold'
            )
            
            label_style = ParagraphStyle(
                'Label',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#333333'),
                spaceAfter=2,
                fontName='Helvetica-Bold'
            )
            
            value_style = ParagraphStyle(
                'Value',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#000000'),
                spaceAfter=8,
                fontName='Helvetica'
            )
            
            section_style = ParagraphStyle(
                'SectionHeader',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#333333'),
                spaceAfter=8,
                fontName='Helvetica-Bold'
            )
            
            normal_style = ParagraphStyle(
                'Normal',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#333333'),
                spaceAfter=4,
                fontName='Helvetica'
            )
            
            footer_style = ParagraphStyle(
                'Footer',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#666666'),
                alignment=TA_CENTER,
                fontName='Helvetica'
            )
            
            # ===== HEADER SECTION =====
            # Left: INVOICE title | Right: Company info
            header_data = [[
                Paragraph("INVOICE", invoice_title_style),
                Paragraph(
                    "<b>HurshBinTech</b><br/>Professional Learning Materials<br/>India",
                    ParagraphStyle(
                        'CompanyInfo',
                        parent=styles['Normal'],
                        fontSize=10,
                        textColor=colors.HexColor('#333333'),
                        alignment=TA_RIGHT,
                        leading=14
                    )
                )
            ]]
            header_table = Table(header_data, colWidths=[3.2*inch, 3.4*inch])
            header_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            elements.append(header_table)
            elements.append(Spacer(1, 0.25*inch))
            
            # ===== META SECTION (Invoice # & Bill To) =====
            meta_data = [[
                Paragraph(
                    f"<b>Invoice No:</b> {invoice_number}<br/><br/><b>Bill to:</b><br/>{customer_name}<br/><font size='8'>{customer_email}</font>",
                    ParagraphStyle(
                        'MetaLeft',
                        parent=styles['Normal'],
                        fontSize=10,
                        textColor=colors.HexColor('#333333'),
                        leading=14
                    )
                ),
                Paragraph(
                    f"<b>Date:</b> {created_at.strftime('%d %B, %Y')}",
                    ParagraphStyle(
                        'MetaRight',
                        parent=styles['Normal'],
                        fontSize=10,
                        textColor=colors.HexColor('#333333'),
                        leading=14,
                        alignment=TA_RIGHT
                    )
                )
            ]]
            meta_table = Table(meta_data, colWidths=[3.3*inch, 3.3*inch])
            meta_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ]))
            elements.append(meta_table)
            elements.append(Spacer(1, 0.2*inch))
            
            # ===== DASHED DIVIDER =====
            from reportlab.platypus import HRFlowable
            elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cccccc'), spaceAfter=20, lineCap='round'))
            elements.append(Spacer(1, 0.05*inch))
            # ===== LINE ITEMS TABLE =====
            items_data = [['Item', 'Description', 'Price', 'Amount']]
            
            item_number = 1
            for item in order_items:
                items_data.append([
                    str(item_number),
                    item['product_name'][:50],
                    f"Rs. {float(item['unit_price']):.2f}",
                    f"Rs. {float(item['line_total']):.2f}"
                ])
                item_number += 1
            
            items_table = Table(
                items_data,
                colWidths=[0.7*inch, 2.8*inch, 1.25*inch, 1.5*inch]
            )
            items_table.setStyle(TableStyle([
                # Header styling - Simple and clean
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#111111')),
                ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                ('ALIGN', (1, 0), (1, 0), 'LEFT'),
                ('ALIGN', (2, 0), (-1, 0), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('LEFTPADDING', (0, 0), (-1, 0), 4),
                ('RIGHTPADDING', (0, 0), (-1, 0), 4),
                ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#cccccc')),
                
                # Body styling
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#333333')),
                
                # Alignment
                ('ALIGN', (0, 1), (0, -1), 'CENTER'),
                ('ALIGN', (1, 1), (1, -1), 'LEFT'),
                ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                
                # Padding
                ('TOPPADDING', (0, 1), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
                ('LEFTPADDING', (0, 1), (-1, -1), 4),
                ('RIGHTPADDING', (0, 1), (-1, -1), 4),
                
                # Borders - light gray lines only
                ('LINEBELOW', (0, 1), (-1, -1), 1, colors.HexColor('#f2f2f2')),
            ]))
            elements.append(items_table)
            elements.append(Spacer(1, 0.15*inch))
            
            # ===== TOTALS SECTION =====
            # Simple total display (no subtotal/discount breakdown in this design)
            total_para = Paragraph(
                f"<b style='font-size: 24px'>Total&nbsp;&nbsp;&nbsp;&nbsp;Rs. {float(total_amount):.2f}</b>",
                ParagraphStyle(
                    'Total',
                    parent=styles['Normal'],
                    alignment=TA_RIGHT,
                    textColor=colors.HexColor('#111111'),
                    spaceAfter=20
                )
            )
            elements.append(total_para)
            elements.append(Spacer(1, 0.2*inch))
            
            # ===== BANK DETAILS SECTION =====
            elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#ddd'), spaceAfter=15))
            
            bank_text = f"<b>Bank Name:</b> HurshBinTech Payment Gateway<br/><b>Contact:</b> support@hurshbintech.com"
            bank_para = Paragraph(bank_text, ParagraphStyle(
                'Bank',
                fontName='Helvetica',
                fontSize=10,
                textColor=colors.HexColor('#333333'),
                leading=14
            ))
            elements.append(bank_para)
            elements.append(Spacer(1, 0.25*inch))
            
            # ===== FOOTER SECTION =====
            elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#ddd'), spaceAfter=12))
            
            footer_text = "If you have any questions please contact : support@hurshbintech.com"
            footer_para = Paragraph(footer_text, ParagraphStyle(
                'Footer',
                fontName='Helvetica',
                fontSize=10,
                textColor=colors.HexColor('#666666'),
                alignment=TA_CENTER
            ))
            elements.append(footer_para)
            
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
