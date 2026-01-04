"""Email Service for sending appointment notifications using Brevo API"""
import logging
from typing import Optional
import aiohttp
import asyncio

from app.core.config import settings

logger = logging.getLogger(__name__)

# Brevo API endpoint
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


class EmailService:
    """Email Service using Brevo API for sending appointment notifications"""
    
    
    # Appointment Request Email - Sent to COACH when a user requests an appointment
    @staticmethod
    async def send_appointment_requested(
        recipient_email: str,
        recipient_name: str,
        client_name: str,
        scheduled_date: str,
        scheduled_time: str,
        session_type: Optional[str] = None,
        appointment_id: int = None,
    ) -> bool:
        """Send appointment request email to coach when user books appointment"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email for {recipient_name}")
            return False

        subject = "New Appointment Request - Hurshbintech"
        
        session_type_display = session_type.replace('_', ' ').title() if session_type else "General Session"
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #41A67E;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                    h2 {{
                        color: #2c3e50;
                        margin: 0;
                    }}
                    p {{
                        margin: 10px 0;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #41A67E;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 6px;
                        margin-top: 20px;
                        font-weight: 600;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 26px;">New Appointment Request</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">A client has requested an appointment with you</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        <p>You have received a new appointment request from <strong>{client_name}</strong>. Please review the details below and respond at your earliest convenience.</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
                            <thead>
                                <tr style="background-color: white; color: black;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd;" colspan="2">Appointment Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Client Name:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{client_name}</td>
                                </tr>
                                <tr style="background-color: #f9f9f9;">
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Date:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{scheduled_date}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Time:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{scheduled_time}</td>
                                </tr>
                                <tr style="background-color: #f9f9f9;">
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Session Type:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{session_type_display}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Reference ID:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;"><span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">#{appointment_id}</span></td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <p>Please log in to your dashboard to accept or decline this appointment request.</p>
                        
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="https://hurshbin.lumesoftai.in:3001/" class="btn" style="color: white;">Go to Dashboard</a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">If you have any questions or need to contact the client, please use the Hurshbintech platform messaging system.</p>
                        
                        <div class="footer">
                            <p>This is an automated message from Hurshbintech. Please do not reply to this email.</p>
                            <p>© 2025 Hurshbintech. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
        """
        return await EmailService._send_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            html_body=html_body,
            email_type="appointment_requested",
        )
    
    # Appointment confirmation email (to user/client)
    @staticmethod
    async def send_appointment_confirmed(
        recipient_email: str,
        recipient_name: str,
        coach_name: str,
        scheduled_date: str,
        scheduled_time: str,
        session_type: Optional[str] = None,
        appointment_id: int = None,
    ) -> bool:
        """Send appointment confirmation email"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email for {recipient_name}")
            return False

        subject = "Appointment Confirmed"
        
        session_type_display = session_type.replace('_', ' ').title() if session_type else "General Session"
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #41A67E;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                    h2 {{
                        color: #2c3e50;
                        margin: 0;
                    }}
                    p {{
                        margin: 10px 0;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 26px;">Appointment Confirmed</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your booking is all set</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        <p>Your appointment request has been confirmed and is ready to go.</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
                            <thead>
                                <tr style="background-color: white; color: black;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd;" colspan="2">Appointment Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Coach:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{coach_name}</td>
                                </tr>
                                <tr style="background-color: #f9f9f9;">
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Date:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{scheduled_date}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Time:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{scheduled_time}</td>
                                </tr>
                                <tr style="background-color: #f9f9f9;">
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Session Type:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{session_type_display}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Reference ID:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;"><span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">#{appointment_id}</span></td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <p><strong>What's Next:</strong></p>
                        <ul style="color: #555;">
                            <li>Join the session on time</li>
                            <li>Have all necessary materials ready</li>
                            <li>Contact your coach if you need to reschedule</li>
                        </ul>
                        
                        <p style="color: #666; font-size: 14px;">If you have any questions about your appointment, please contact <strong>{coach_name}</strong> or our support team.</p>
                        
                        <div class="footer">
                            <p>This is an automated message from Hurshbintech. Please do not reply to this email.</p>
                            <p>© 2025 Hurshbintech. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
        """
        
        return await EmailService._send_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            html_body=html_body,
            email_type="appointment_confirmed",
        )

    # Guest Appointment Confirmation with Session Link
    @staticmethod
    async def send_guest_appointment_confirmed_with_session_link(
        recipient_email: str,
        recipient_name: str,
        coach_name: str,
        scheduled_date: str,
        scheduled_time: str,
        session_type: Optional[str] = None,
        appointment_id: int = None,
        session_link: str = None,
    ) -> bool:
        """Send appointment confirmation email to guest with session join link"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email for {recipient_name}")
            return False

        subject = "Appointment Confirmed - Join Your Session"
        
        session_type_display = session_type.replace('_', ' ').title() if session_type else "General Session"
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #41A67E;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .session-link-box {{
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 20px;
                        border-radius: 8px;
                        margin: 25px 0;
                        text-align: center;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 14px 32px;
                        background-color: #10b981;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 16px;
                        margin-top: 10px;
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                    h2 {{
                        color: #2c3e50;
                        margin: 0;
                    }}
                    p {{
                        margin: 10px 0;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 26px;">✓ Appointment Confirmed!</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your session is ready</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        <p>Great news! Your appointment has been confirmed and you're all set for your session with <strong>{coach_name}</strong>.</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
                            <thead>
                                <tr style="background-color: white; color: black;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd;" colspan="2">Appointment Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Coach:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{coach_name}</td>
                                </tr>
                                <tr style="background-color: #f9f9f9;">
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Date:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{scheduled_date}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Time:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{scheduled_time}</td>
                                </tr>
                                <tr style="background-color: #f9f9f9;">
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Session Type:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{session_type_display}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Reference ID:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;"><span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">#{appointment_id}</span></td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <div class="session-link-box">
                            <h3 style="color: white; margin: 0 0 10px 0; font-size: 18px;">🎥 Join Your Video Session</h3>
                            <p style="color: rgba(255,255,255,0.9); margin: 0 0 15px 0; font-size: 14px;">Click the button below on your scheduled date and time to join your session</p>
                            <a href="{session_link}" class="btn">Join Session</a>
                        </div>
                        
                        <p><strong>⚠️ Important:</strong></p>
                        <ul style="color: #555;">
                            <li><strong>Save this email!</strong> You'll need the link above to join your session</li>
                            <li>Join the session a few minutes before your scheduled time</li>
                            <li>Make sure you have a stable internet connection</li>
                            <li>Test your camera and microphone before joining</li>
                        </ul>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 20px;">
                            <strong>Note:</strong> This session link is unique and secure. Do not share it with others.
                            If you need to reschedule or have questions, please contact <strong>{coach_name}</strong>.
                        </p>
                        
                        <div class="footer">
                            <p>This is an automated message from Hurshbintech. Please do not reply to this email.</p>
                            <p>© 2025 Hurshbintech. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
        """
        
        return await EmailService._send_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            html_body=html_body,
            email_type="guest_appointment_confirmed_with_link",
        )


    # Appointment Rejection email (to user/client)
    @staticmethod
    async def send_appointment_rejected(
        recipient_email: str,
        recipient_name: str,
        coach_name: str,
        rejection_reason: Optional[str],
        scheduled_date: str,
        scheduled_time: str,
        appointment_id: int,
    ) -> bool:
        """Send appointment rejection email"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email for {recipient_name}")
            return False

        subject = "Appointment Status Update"
        
        reason_text = rejection_reason or "We were unable to accommodate this appointment at this time."
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #D25D5D;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                    h2 {{
                        color: #2c3e50;
                        margin: 0;
                    }}
                    p {{
                        margin: 10px 0;
                    }}
                    .reason-box {{
                        background-color: #fff8e1;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 15px 0;
                        border-left: 4px solid #fbc02d;
                    }}
                    .next-steps {{
                        background-color: #e8f5e9;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 15px 0;
                        border-left: 4px solid #4caf50;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 26px;">Appointment Status Update</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your booking status has changed</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        <p>We're writing to inform you that your appointment request with <strong>{coach_name}</strong> could not be confirmed at this time.</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
                            <thead>
                                <tr style="background-color: white; color: black;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd;" colspan="2">Appointment Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Coach:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{coach_name}</td>
                                </tr>
                                <tr style="background-color: #f9f9f9;">
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Requested Date:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{scheduled_date}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Requested Time:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;">{scheduled_time}</td>
                                </tr>
                                <tr style="background-color: #f9f9f9;">
                                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; color: #2c3e50; width: 30%;">Reference ID:</td>
                                    <td style="padding: 12px; border: 1px solid #ddd; color: #555;"><span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">#{appointment_id}</span></td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <div class="reason-box">
                            <h4 style="margin-top: 0; color: #f57f17;">Reason for Update</h4>
                            <p style="margin-bottom: 0; color: #555;">{reason_text}</p>
                        </div>
                        
                        <div class="next-steps">
                            <strong style="display: block; margin-bottom: 8px; color: #2e7d32;">What You Can Do</strong>
                            <ul style="margin: 10px 0; padding-left: 20px; color: #555;">
                                <li>Try scheduling another appointment at a different time</li>
                                <li>Request an appointment with a different coach</li>
                                <li>Contact support if you have any questions</li>
                            </ul>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">We appreciate your understanding and look forward to helping you find a suitable appointment time.</p>
                        
                        <div class="footer">
                            <p>This is an automated message from Hurshbintech. Please do not reply to this email.</p>
                            <p>© 2025 Hurshbintech. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
        """
        
        return await EmailService._send_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            html_body=html_body,
            email_type="appointment_rejected",
        )

    @staticmethod
    async def send_payment_instructions(
        recipient_email: str,
        recipient_name: str,
        order_number: str,
        payment_method: str,
        total_amount: float,
        upi_details: Optional[dict] = None,
        bank_details: Optional[dict] = None,
    ) -> bool:
        """Send payment instructions email after order creation"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email")
            return False

        subject = f"Payment Instructions for Order {order_number}"
        
        # Build payment details HTML based on method
        payment_html = ""
        if payment_method == "UPI_QR" and upi_details:
            payment_html = f"""
                <h3 style="color: #2c3e50; margin-top: 25px;">📱 UPI Payment Instructions</h3>
                <div style="background: #e8f5e9; border-left: 4px solid #27ae60; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <p style="margin: 10px 0; font-weight: 600;">Step 1: Scan the QR Code</p>
                    <div style="text-align: center; background: white; padding: 20px; border-radius: 6px; margin: 10px 0;">
                        <p style="color: #999; font-size: 14px; margin: 0 0 15px 0;">📷 QR Code Image</p>
                        <div style="background: #f0f0f0; height: 200px; width: 200px; margin: 0 auto; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #999;">
                            [QR Code Here]
                        </div>
                    </div>
                    
                    <p style="margin: 10px 0 5px 0;"><strong>OR manually enter UPI ID:</strong></p>
                    <div style="background: white; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; color: #e74c3c;">
                        {upi_details.get('merchant_upi', 'N/A')}
                    </div>
                    
                    <p style="margin: 15px 0 10px 0; font-weight: 600;">Step 2: Enter Amount & Reference</p>
                    <ul style="margin: 5px 0; padding-left: 20px; color: #555;">
                        <li><strong>Amount:</strong> ₹{total_amount:.2f}</li>
                        <li><strong>Reference/Note:</strong> {order_number} (Please include order ID)</li>
                    </ul>
                    
                    <p style="margin: 15px 0 0 0; font-weight: 600;">Step 3: Complete Payment</p>
                    <p style="margin: 5px 0; color: #555;">Confirm and submit payment from your UPI app</p>
                </div>
            """
        elif payment_method == "BANK_TRANSFER" and bank_details:
            payment_html = f"""
                <h3 style="color: #2c3e50; margin-top: 25px;">🏦 Bank Transfer Instructions</h3>
                <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <p style="margin: 10px 0; font-weight: 600;">Bank Account Details:</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 10px 0; background: white;">
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 12px; font-weight: 600; color: #2c3e50; width: 40%;">Bank Name</td>
                            <td style="padding: 12px; color: #555; font-family: monospace;">{bank_details.get('bank_name', 'N/A')}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd; background: #f9f9f9;">
                            <td style="padding: 12px; font-weight: 600; color: #2c3e50;">Account Holder</td>
                            <td style="padding: 12px; color: #555; font-family: monospace;">{bank_details.get('account_holder', 'N/A')}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 12px; font-weight: 600; color: #2c3e50;">Account Number</td>
                            <td style="padding: 12px; color: #555; font-family: monospace; background: #f0f0f0;">{bank_details.get('account_number', 'N/A')}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd; background: #f9f9f9;">
                            <td style="padding: 12px; font-weight: 600; color: #2c3e50;">IFSC Code</td>
                            <td style="padding: 12px; color: #555; font-family: monospace; background: #f0f0f0;">{bank_details.get('ifsc_code', 'N/A')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; font-weight: 600; color: #27ae60; font-size: 16px;">Amount to Pay</td>
                            <td style="padding: 12px; color: #27ae60; font-weight: 600; font-size: 16px;">₹{total_amount:.2f}</td>
                        </tr>
                    </table>
                    
                    <div style="background: #fff3cd; border-left: 4px solid #f39c12; padding: 12px; margin-top: 15px; border-radius: 4px;">
                        <strong style="color: #856404;">⚠️ Important:</strong> <span style="color: #856404;">Use <strong>{order_number}</strong> as the payment reference/narration for quick verification</span>
                    </div>
                </div>
            """
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #2196f3;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 26px;">💳 Payment Instructions</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Please complete your payment to proceed</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        
                        <p>Thank you for your order! Your items are ready to be prepared once payment is received.</p>
                        
                        <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <p style="margin: 0; color: #666;">
                                <strong style="color: #2c3e50;">Order Number:</strong> <span style="font-family: monospace; color: #e74c3c; font-weight: 600;">{order_number}</span>
                            </p>
                            <p style="margin: 8px 0 0 0; color: #666;">
                                <strong style="color: #2c3e50;">Amount Due:</strong> <span style="color: #27ae60; font-weight: 600; font-size: 18px;">₹{total_amount:.2f}</span>
                            </p>
                        </div>
                        
                        {payment_html}
                        
                        <h3 style="color: #2c3e50; margin-top: 30px;">⏱️ What Happens Next</h3>
                        <ol style="color: #555; line-height: 1.8;">
                            <li>Complete the payment using the instructions above</li>
                            <li>Upload your payment receipt on the order page</li>
                            <li>Our team will verify your payment within 24 hours</li>
                            <li>Once approved, your order will be prepared and shipped</li>
                            <li>You'll receive tracking details via email</li>
                        </ol>
                        
                        <h3 style="color: #2c3e50; margin-top: 25px;">❓ Questions?</h3>
                        <p style="color: #666; margin: 10px 0;">
                            If you have any issues making the payment, please contact our support team at:
                        </p>
                        <p style="margin: 5px 0; color: #2196f3; font-weight: 600;">
                            📧 Email: support@hurshbintech.com<br>
                            📱 WhatsApp: +91-XXXXXXXXXX
                        </p>
                        
                        <div style="background: #fff3cd; border-left: 4px solid #f39c12; padding: 15px; margin-top: 20px; border-radius: 6px;">
                            <p style="margin: 0; color: #856404;"><strong>⏰ Time Sensitive:</strong> Please complete the payment within 24 hours to secure your order slot.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2025 HurshBintech. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        return await EmailService._send_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            html_body=html_body,
            email_type="payment_instructions",
        )

    @staticmethod
    async def _send_email(
        recipient_email: str,
        recipient_name: str,
        subject: str,
        html_body: str,
        email_type: str = "general",
    ) -> bool:
        """
        Internal method to send email via Brevo API
        
        Args:
            recipient_email: Email address of recipient
            recipient_name: Name of recipient
            subject: Email subject
            html_body: HTML body of email
            email_type: Type of email (for logging/tracking)
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        
        try:
            if not settings.BREVO_API_KEY:
                logger.warning("Brevo API key not configured, skipping email send")
                return False
            
            # Prepare payload for Brevo API
            payload = {
                "sender": {
                    "name": settings.SENDER_NAME,
                    "email": settings.SENDER_EMAIL
                },
                "to": [
                    {
                        "email": recipient_email,
                        "name": recipient_name
                    }
                ],
                "subject": subject,
                "htmlContent": html_body,
                "headers": {
                    "X-Email-Type": email_type
                }
            }
            
            # Send via Brevo API
            headers = {
                "api-key": settings.BREVO_API_KEY,
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    BREVO_API_URL,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    if response.status == 201:
                        response_data = await response.json()
                        message_id = response_data.get("messageId", "unknown")
                        logger.info(
                            f"✓ Email sent to {recipient_email} via Brevo | "
                            f"Type: {email_type} | Subject: {subject} | MessageID: {message_id}"
                        )
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(
                            f"✗ Failed to send email to {recipient_email} via Brevo | "
                            f"Status: {response.status} | Response: {error_text}"
                        )
                        return False
            
        except asyncio.TimeoutError:
            logger.error(f"✗ Brevo API timeout while sending email to {recipient_email}")
            return False
        except Exception as e:
            logger.error(
                f"✗ Failed to send email to {recipient_email} via Brevo | "
                f"Error: {str(e)} | Type: {type(e).__name__}"
            )
            return False

    # ========== GUEST BOOKING EMAILS ==========

    @staticmethod
    async def send_guest_otp_email(
        recipient_email: str,
        otp_code: str,
    ) -> bool:
        """Send OTP to guest email for verification"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email")
            return False

        subject = "Your OTP for Hurshbintech Booking - Valid for 10 Minutes"
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #41A67E;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .otp-box {{
                        background-color: #f3f4f6;
                        border-left: 4px solid #41A67E;
                        padding: 20px;
                        margin: 20px 0;
                        border-radius: 4px;
                        text-align: center;
                    }}
                    .otp-code {{
                        font-size: 32px;
                        font-weight: bold;
                        color: #41A67E;
                        letter-spacing: 4px;
                        font-family: 'Courier New', monospace;
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                    .warning {{
                        background-color: #fff3cd;
                        border: 1px solid #ffc107;
                        padding: 15px;
                        border-radius: 4px;
                        margin: 20px 0;
                        font-size: 14px;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 24px;">Verify Your Email</h1>
                    </div>
                    <div class="content">
                        <p>Hi,</p>
                        <p>Your OTP for booking with Hurshbintech is ready:</p>
                        
                        <div class="otp-box">
                            <div class="otp-code">{otp_code}</div>
                        </div>
                        
                        <div class="warning">
                            ⏱️ <strong>This OTP is valid for 10 minutes only.</strong> If you don't use it within 10 minutes, you'll need to request a new one.
                        </div>
                        
                        <p><strong>What's next?</strong></p>
                        <ol>
                            <li>Enter this OTP on the booking page</li>
                            <li>Provide your details (name, phone, preferred date/time)</li>
                            <li>Wait for coach approval</li>
                            <li>Coach will send you a payment upload link</li>
                        </ol>
                        
                        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
                            If you didn't request this OTP, please ignore this email.
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Hurshbintech. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                }
                
                payload = {
                    "sender": {
                        "name": "Hurshbintech",
                        "email": settings.SENDER_EMAIL,
                    },
                    "to": [{"email": recipient_email}],
                    "subject": subject,
                    "htmlContent": html_body,
                }
                
                timeout = aiohttp.ClientTimeout(total=10)
                async with session.post(BREVO_API_URL, json=payload, headers=headers, timeout=timeout) as response:
                    if response.status == 201:
                        logger.info(f"✓ OTP email sent successfully to {recipient_email}")
                        return True
                    else:
                        logger.error(f"✗ Brevo API error: {response.status}")
                        return False
        
        except asyncio.TimeoutError:
            logger.error(f"✗ Brevo API timeout while sending OTP email to {recipient_email}")
            return False
        except Exception as e:
            logger.error(f"✗ Failed to send OTP email: {str(e)}")
            return False

    @staticmethod
    async def send_guest_intent_notification_to_coach(
        coach_email: str,
        coach_name: str,
        guest_name: str,
        guest_email: str,
        appointment_id: int,
        scheduled_date,
        scheduled_time: str,
    ) -> bool:
        """Send notification to coach about new guest booking intent"""
        
        if not settings.ENABLE_EMAIL or not coach_email:
            logger.warning(f"Email sending disabled or no coach email")
            return False

        subject = f"New Guest Booking Request - {guest_name}"
        
        date_str = scheduled_date.isoformat() if hasattr(scheduled_date, 'isoformat') else str(scheduled_date)
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #41A67E;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .details-box {{
                        background-color: #f9f9f9;
                        border-left: 4px solid #41A67E;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #41A67E;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 6px;
                        margin-top: 20px;
                        font-weight: 600;
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 24px;">New Guest Booking Request</h1>
                    </div>
                    <div class="content">
                        <p>Hi {coach_name},</p>
                        <p>You have a new booking request from a guest:</p>
                        
                        <div class="details-box">
                            <p><strong>Guest Name:</strong> {guest_name}</p>
                            <p><strong>Guest Email:</strong> {guest_email}</p>
                            <p><strong>Requested Date:</strong> {date_str}</p>
                            <p><strong>Requested Time:</strong> {scheduled_time}</p>
                            <p><strong>Status:</strong> <span style="color: #f59e0b;">Awaiting Your Review</span></p>
                        </div>
                        
                        <p><strong>Next Steps:</strong></p>
                        <ol>
                            <li>Review the guest's request on your Hurshbintech dashboard</li>
                            <li>Click <strong>"Approve"</strong> to send them a payment upload link</li>
                            <li>Guest will upload payment screenshot</li>
                            <li>Review and confirm the appointment</li>
                        </ol>
                        
                        <a href="{settings.FRONTEND_URL}/coach/dashboard" class="btn">View on Dashboard</a>
                        
                        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
                            This is an automated notification from Hurshbintech.
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Hurshbintech. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                }
                
                payload = {
                    "sender": {
                        "name": "Hurshbintech",
                        "email": settings.SENDER_EMAIL,
                    },
                    "to": [{"email": coach_email}],
                    "subject": subject,
                    "htmlContent": html_body,
                }
                
                timeout = aiohttp.ClientTimeout(total=10)
                async with session.post(BREVO_API_URL, json=payload, headers=headers, timeout=timeout) as response:
                    if response.status == 201:
                        logger.info(f"✓ Guest intent notification sent to {coach_email}")
                        return True
                    else:
                        logger.error(f"✗ Brevo API error: {response.status}")
                        return False
        
        except asyncio.TimeoutError:
            logger.error(f"✗ Brevo API timeout sending guest intent notification")
            return False
        except Exception as e:
            logger.error(f"✗ Failed to send guest intent notification: {str(e)}")
            return False

    @staticmethod
    async def send_payment_upload_link_to_guest(
        guest_email: str,
        guest_name: str,
        upload_url: str,
        token_expires_in_hours: int = 24,
        coach_name: str = "Your Coach",
    ) -> bool:
        """Send payment upload link to guest after coach approval"""
        
        if not settings.ENABLE_EMAIL or not guest_email:
            logger.warning(f"Email sending disabled or no guest email")
            return False

        subject = "Payment Upload Link - Hurshbintech Booking Approved!"
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #10b981;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .success-message {{
                        background-color: #d1fae5;
                        border-left: 4px solid #10b981;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #10b981;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 6px;
                        margin-top: 20px;
                        font-weight: 600;
                    }}
                    .warning {{
                        background-color: #fff3cd;
                        border: 1px solid #ffc107;
                        padding: 15px;
                        border-radius: 4px;
                        margin: 20px 0;
                        font-size: 14px;
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 24px;">✓ Booking Approved!</h1>
                    </div>
                    <div class="content">
                        <p>Hi {guest_name},</p>
                        
                        <div class="success-message">
                            <p style="margin: 0;"><strong>Great news!</strong> {coach_name} has approved your booking request. Now you just need to upload your payment screenshot.</p>
                        </div>
                        
                        <p><strong>Upload Your Payment Receipt:</strong></p>
                        <p>Click the button below to upload your payment screenshot. This link is secure and unique to your booking.</p>
                        
                        <a href="{upload_url}" class="btn">Upload Payment</a>
                        
                        <div class="warning">
                            ⏱️ <strong>This link expires in {token_expires_in_hours} hours.</strong> Please upload your payment screenshot before the link expires.
                        </div>
                        
                        <p><strong>What to upload:</strong></p>
                        <ul>
                            <li>Screenshot of your payment confirmation</li>
                            <li>Bank transfer receipt</li>
                            <li>Payment gateway confirmation (UPI, card, etc.)</li>
                        </ul>
                        
                        <p style="color: #6b7280; margin-top: 20px;">
                            After you upload, {coach_name} will review your payment and confirm the final booking.
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Hurshbintech. All rights reserved.</p>
                        <p><strong>Note:</strong> This is a secure link. Do not share it with others.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                }
                
                payload = {
                    "sender": {
                        "name": "Hurshbintech",
                        "email": settings.SENDER_EMAIL,
                    },
                    "to": [{"email": guest_email}],
                    "subject": subject,
                    "htmlContent": html_body,
                }
                
                timeout = aiohttp.ClientTimeout(total=10)
                async with session.post(BREVO_API_URL, json=payload, headers=headers, timeout=timeout) as response:
                    if response.status == 201:
                        logger.info(f"✓ Payment upload link sent to {guest_email}")
                        return True
                    else:
                        logger.error(f"✗ Brevo API error: {response.status}")
                        return False
        
        except asyncio.TimeoutError:
            logger.error(f"✗ Brevo API timeout sending payment upload link")
            return False
        except Exception as e:
            logger.error(f"✗ Failed to send payment upload link: {str(e)}")
            return False

    @staticmethod
    async def send_guest_payment_uploaded_notification_to_coach(
        coach_email: str,
        coach_name: str,
        guest_name: str,
        appointment_id: int,
    ) -> bool:
        """Notify coach that guest has uploaded payment screenshot"""
        
        if not settings.ENABLE_EMAIL or not coach_email:
            logger.warning(f"Email sending disabled or no coach email")
            return False

        subject = f"Payment Uploaded - {guest_name}'s Booking Ready for Review"
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #3b82f6;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .info-box {{
                        background-color: #eff6ff;
                        border-left: 4px solid #3b82f6;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #3b82f6;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 6px;
                        margin-top: 20px;
                        font-weight: 600;
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 24px;">Payment Screenshot Received</h1>
                    </div>
                    <div class="content">
                        <p>Hi {coach_name},</p>
                        
                        <div class="info-box">
                            <p style="margin: 0;"><strong>{guest_name}</strong> has uploaded their payment screenshot and is awaiting your review.</p>
                        </div>
                        
                        <p><strong>Next Steps:</strong></p>
                        <ol>
                            <li>Review the payment receipt on your dashboard</li>
                            <li>Verify the amount and transaction details</li>
                            <li>Click <strong>"Confirm"</strong> to finalize the booking</li>
                        </ol>
                        
                        <a href="{settings.FRONTEND_URL}/coach/dashboard" class="btn">Review Payment</a>
                        
                        <p style="color: #6b7280; margin-top: 20px;">
                            Appointment ID: <strong>#{appointment_id}</strong>
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Hurshbintech. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                }
                
                payload = {
                    "sender": {
                        "name": "Hurshbintech",
                        "email": settings.SENDER_EMAIL,
                    },
                    "to": [{"email": coach_email}],
                    "subject": subject,
                    "htmlContent": html_body,
                }
                
                timeout = aiohttp.ClientTimeout(total=10)
                async with session.post(BREVO_API_URL, json=payload, headers=headers, timeout=timeout) as response:
                    if response.status == 201:
                        logger.info(f"✓ Payment uploaded notification sent to {coach_email}")
                        return True
                    else:
                        logger.error(f"✗ Brevo API error: {response.status}")
                        return False
        
        except asyncio.TimeoutError:
            logger.error(f"✗ Brevo API timeout sending payment uploaded notification")
            return False
        except Exception as e:
            logger.error(f"✗ Failed to send payment uploaded notification: {str(e)}")
            return False

    # ========== E-COMMERCE ORDER EMAILS ==========

    @staticmethod
    async def send_order_confirmation(
        recipient_email: str,
        recipient_name: str,
        order_number: str,
        order_items: list,
        subtotal: float,
        discount: float,
        total: float,
        delivery_address: str,
    ) -> bool:
        """Send order confirmation email after payment approval"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email")
            return False

        subject = f"Order Confirmed - {order_number}"
        
        # Build items HTML
        items_html = ""
        for item in order_items:
            items_html += f"""
                <tr>
                    <td style="padding: 12px; border: 1px solid #ddd;">{item['product_name']}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">{item['quantity']}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">₹{item['unit_price']:.2f}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">₹{item['line_total']:.2f}</td>
                </tr>
            """
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #10b981;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .success-badge {{
                        background-color: #d1fae5;
                        color: #065f46;
                        padding: 8px 16px;
                        border-radius: 20px;
                        display: inline-block;
                        font-weight: 600;
                        margin: 10px 0;
                    }}
                    table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }}
                    th {{
                        background-color: #f9fafb;
                        padding: 12px;
                        text-align: left;
                        border: 1px solid #ddd;
                        font-weight: 600;
                    }}
                    td {{
                        padding: 12px;
                        border: 1px solid #ddd;
                    }}
                    .totals {{
                        margin-top: 20px;
                        padding: 15px;
                        background-color: #f9fafb;
                        border-radius: 6px;
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 26px;">✓ Order Confirmed!</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your payment has been verified</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        
                        <div class="success-badge">Payment Verified ✓</div>
                        
                        <p>Great news! Your order has been confirmed and is ready to ship.</p>
                        
                        <h3 style="color: #2c3e50; margin-top: 25px;">Order Details</h3>
                        <p><strong>Order ID:</strong> {order_number}</p>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th style="text-align: center;">Qty</th>
                                    <th style="text-align: right;">Price</th>
                                    <th style="text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items_html}
                            </tbody>
                        </table>
                        
                        <div class="totals">
                            <table style="border: none; margin: 0;">
                                <tr style="border: none;">
                                    <td style="border: none; padding: 5px; font-weight: 600;">Subtotal:</td>
                                    <td style="border: none; padding: 5px; text-align: right;">₹{subtotal:.2f}</td>
                                </tr>
                                <tr style="border: none;">
                                    <td style="border: none; padding: 5px; font-weight: 600;">Discount:</td>
                                    <td style="border: none; padding: 5px; text-align: right; color: #10b981;">-₹{discount:.2f}</td>
                                </tr>
                                <tr style="border: none;">
                                    <td style="border: none; padding: 5px; font-weight: bold; font-size: 18px; color: #2c3e50;">Total:</td>
                                    <td style="border: none; padding: 5px; text-align: right; font-weight: bold; font-size: 18px; color: #2c3e50;">₹{total:.2f}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <h3 style="color: #2c3e50; margin-top: 25px;">Delivery Address</h3>
                        <p style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981;">
                            {delivery_address}
                        </p>
                        
                        <h3 style="color: #2c3e50; margin-top: 25px;">What's Next?</h3>
                        <ul style="color: #555;">
                            <li>Your order is ready to ship</li>
                            <li>You'll receive a shipping confirmation within 24 hours</li>
                            <li>Track your order on our website</li>
                        </ul>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            Questions? Contact us at support@hurshbintech.com
                        </p>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <p style="font-weight: 600; color: #2c3e50;">Thank you for shopping with us!</p>
                            <p style="color: #10b981; font-size: 18px;">❤️ HurshBintech Team</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2025 HurshBintech. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        return await EmailService._send_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            html_body=html_body,
            email_type="order_confirmation",
        )

    @staticmethod
    async def send_order_rejection(
        recipient_email: str,
        recipient_name: str,
        order_number: str,
        rejection_reason: str,
    ) -> bool:
        """Send order rejection email when payment is rejected"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email")
            return False

        subject = f"Payment Verification Needed - {order_number}"
        
        html_body = f"""
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 10px;
                        background-color: #f0f4ff;
                    }}
                    .header {{
                        background-color: #dc2626;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        color: white;
                        text-align: center;
                    }}
                    .content {{
                        background-color: white;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }}
                    .reason-box {{
                        background-color: #fef2f2;
                        border-left: 4px solid #dc2626;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }}
                    .next-steps {{
                        background-color: #eff6ff;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                        border-left: 4px solid #3b82f6;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #3b82f6;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 6px;
                        margin-top: 20px;
                        font-weight: 600;
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 26px;">Payment Verification Needed</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Action Required</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        
                        <p>We couldn't verify your payment receipt for order <strong>{order_number}</strong>.</p>
                        
                        <div class="reason-box">
                            <h4 style="margin-top: 0; color: #991b1b;">Reason</h4>
                            <p style="margin-bottom: 0; color: #555;">{rejection_reason}</p>
                        </div>
                        
                        <div class="next-steps">
                            <h4 style="margin-top: 0; color: #1e40af;">What You Can Do</h4>
                            <ul style="margin: 10px 0; padding-left: 20px; color: #555;">
                                <li>Upload a clearer receipt with visible transaction details</li>
                                <li>Ensure the amount and payment method are clearly shown</li>
                                <li>Contact support if you need help</li>
                            </ul>
                        </div>
                        
                        <p><strong>Order ID:</strong> {order_number}</p>
                        
                        <div style="text-align: center;">
                            <a href="{settings.FRONTEND_URL}/orders/{order_number}" class="btn">Upload New Receipt</a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            Questions? Contact us at support@hurshbintech.com or call +91-XXXXXXXXXX
                        </p>
                        
                        <p style="color: #999; font-size: 13px; margin-top: 25px;">
                            We're here to help! Our team will review your new receipt within 24 hours.
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2025 HurshBintech. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        return await EmailService._send_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            html_body=html_body,
            email_type="order_rejection",
        )

