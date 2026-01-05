"""Email Service for sending appointment notifications using Brevo API"""
import logging
from typing import Optional
from datetime import datetime
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
                            <p>© 2026 Hurshbintech. All rights reserved.</p>
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
                            <p>© 2026 Hurshbintech. All rights reserved.</p>
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
                            <p>© 2026 Hurshbintech. All rights reserved.</p>
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
                            <p>© 2026 Hurshbintech. All rights reserved.</p>
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
    async def _send_email(
        recipient_email: str,
        recipient_name: str,
        subject: str,
        html_body: str,
        email_type: str = "general",
        attachments: Optional[list] = None,
    ) -> bool:
        """
        Internal method to send email via Brevo API
        
        Args:
            recipient_email: Email address of recipient
            recipient_name: Name of recipient
            subject: Email subject
            html_body: HTML body of email
            email_type: Type of email (for logging/tracking)
            attachments: Optional list of attachments with keys: name, content (base64), type
            
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
            
            # Add attachments if provided
            if attachments:
                payload["attachment"] = attachments
            
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
                        attachment_str = f" | Attachments: {len(attachments)}" if attachments else ""
                        logger.info(
                            f"✓ Email sent to {recipient_email} via Brevo | "
                            f"Type: {email_type} | Subject: {subject} | MessageID: {message_id}{attachment_str}"
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
                        <p>© 2026 Hurshbintech. All rights reserved.</p>
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
                        <p>© 2026 Hurshbintech. All rights reserved.</p>
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
                        <p>© 2026 Hurshbintech. All rights reserved.</p>
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
                        <p>© 2026 Hurshbintech. All rights reserved.</p>
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
    async def send_order_created(
        recipient_email: str,
        recipient_name: str,
        order_number: str,
        order_items: list,
        subtotal: float,
        discount: float,
        total: float,
        delivery_address: str,
        payment_method: str,
        upi_details: Optional[dict] = None,
        bank_details: Optional[dict] = None,
    ) -> bool:
        """Send order created email with order details and payment instructions"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email")
            return False

        subject = f"Order Created - {order_number} | Payment Instructions Inside"
        
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
                        background-color: #f39c12;
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
                    .info-badge {{
                        background-color: #fff8e1;
                        color: #f39c12;
                        padding: 10px 16px;
                        border-radius: 6px;
                        display: inline-block;
                        font-weight: 600;
                        margin: 15px 0;
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
                        <h1 style="margin: 0; font-size: 26px;">📦 Order Created Successfully!</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your order is ready for payment</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        
                        <p>Thank you for placing your order! We've created your order and are waiting for payment to proceed.</p>
                        
                        <div class="info-badge">Order Awaiting Payment ⏳</div>
                        
                        <h3 style="color: #2c3e50; margin-top: 25px;">Order Summary</h3>
                        <p><strong>Order ID:</strong> <span style="font-family: monospace; color: #e74c3c; font-weight: 600;">{order_number}</span></p>
                        
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
                                    <td style="border: none; padding: 5px; text-align: right; color: #27ae60;">-₹{discount:.2f}</td>
                                </tr>
                                <tr style="border: none;">
                                    <td style="border: none; padding: 5px; font-weight: bold; font-size: 18px; color: #2c3e50;">Total Amount:</td>
                                    <td style="border: none; padding: 5px; text-align: right; font-weight: bold; font-size: 18px; color: #f39c12;">₹{total:.2f}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <h3 style="color: #2c3e50; margin-top: 25px;">📍 Delivery Address</h3>
                        <p style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #f39c12;">
                            {delivery_address}
                        </p>
                        
                        <h3 style="color: #2c3e50; margin-top: 25px;">❓ Questions or Issues?</h3>
                        <p style="color: #666; margin: 10px 0;">
                            If you face any issues or have questions about payment:
                        </p>
                        <p style="margin: 5px 0; color: #2c3e50; font-weight: 600;">
                            📧 Email: support@hurshbintech.com<br>
                            📱 WhatsApp: +91-XXXXXXXXXX
                        </p>
                        
                        <div style="background: #fff3cd; border-left: 4px solid #f39c12; padding: 15px; margin-top: 20px; border-radius: 6px;">
                            <p style="margin: 0; color: #856404;"><strong>⏰ Time Sensitive:</strong> Please complete the payment within 24 hours to secure your order slot.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2026 HurshBintech. All rights reserved.</p>
                        <p>This email contains your order details and payment instructions. Please keep it for your records.</p>
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
            email_type="order_created",
        )

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
        invoice_number: Optional[str] = None,
        invoice_pdf_url: Optional[str] = None,
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
        
        # Build invoice note if available
        invoice_note = ""
        if invoice_number:
            invoice_note = f"""
                        <h3 style="color: #2c3e50; margin-top: 25px;">Invoice</h3>
                        <p><strong>Invoice Number:</strong> {invoice_number}</p>
                        <p style="color: #666; font-size: 14px;">Your invoice PDF is attached to this email for your records.</p>
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
                        
                        {invoice_note}
                        
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
                        <p>© 2026 HurshBintech. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        # Prepare attachment if invoice PDF URL exists
        attachments = None
        if invoice_pdf_url:
            logger.info(f"Attempting to attach invoice PDF: {invoice_pdf_url}")
            try:
                import base64
                import os
                
                pdf_bytes = None
                
                # Check if using S3 or local storage
                if settings.USE_S3:
                    # S3 mode - download from S3
                    import boto3
                    from botocore.exceptions import ClientError
                    
                    s3_client = boto3.client(
                        "s3",
                        region_name=os.getenv("AWS_REGION", "ap-south-1"),
                        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                    )
                    
                    # Parse S3 path and download
                    # invoice_pdf_url is like "uploads/invoices/2026/order-id/INV-2026-000001.pdf"
                    pdf_response = s3_client.get_object(
                        Bucket=settings.S3_BUCKET_NAME,
                        Key=invoice_pdf_url
                    )
                    pdf_bytes = pdf_response['Body'].read()
                    logger.info(f"Invoice PDF downloaded from S3: {invoice_pdf_url}")
                else:
                    # Local mode - read from local file system
                    # invoice_pdf_url might be something like "invoices/2026/order-id/INV-2026-000001.pdf"
                    # Normalize the path to use OS-specific separators
                    normalized_url = invoice_pdf_url.replace("/", os.sep).replace("\\", os.sep)
                    
                    possible_paths = [
                        os.path.join("uploads", normalized_url),  # uploads/invoices/...
                        normalized_url,  # direct path
                        os.path.join(os.getcwd(), "uploads", normalized_url),  # absolute path
                    ]
                    
                    pdf_bytes = None
                    for file_path in possible_paths:
                        logger.debug(f"Checking invoice file at: {file_path} (exists: {os.path.exists(file_path)})")
                        if os.path.exists(file_path):
                            try:
                                with open(file_path, 'rb') as f:
                                    pdf_bytes = f.read()
                                logger.info(f"✓ Invoice PDF read from local storage: {file_path} ({len(pdf_bytes)} bytes)")
                                break
                            except Exception as read_error:
                                logger.error(f"Error reading PDF file {file_path}: {str(read_error)}")
                                continue
                    
                    if not pdf_bytes:
                        logger.warning(f"✗ Invoice PDF not found in local storage. Tried paths: {possible_paths}")
                
                # If we successfully read the PDF, attach it
                if pdf_bytes:
                    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                    
                    attachments = [
                        {
                            "name": f"{invoice_number}.pdf",
                            "content": pdf_base64,
                            "type": "application/pdf"
                        }
                    ]
                    
                    logger.info(f"✓ Invoice PDF prepared for attachment to {recipient_email}")
                else:
                    logger.warning(f"Could not read invoice PDF for attachment to {recipient_email}")
                    attachments = None
                    
            except Exception as e:
                logger.error(f"Error preparing invoice PDF attachment: {str(e)}")
                # Continue without attachment if download fails
                attachments = None
        
        return await EmailService._send_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            html_body=html_body,
            email_type="order_confirmation",
            attachments=attachments
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
                        <p>© 2026 HurshBintech. All rights reserved.</p>
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

    @staticmethod
    async def send_order_delivered(
        recipient_email: str,
        recipient_name: str,
        order_number: str,
        delivery_address: str,
    ) -> bool:
        """Send order delivery email when order is marked as delivered"""
        
        if not settings.ENABLE_EMAIL or not recipient_email:
            logger.warning(f"Email sending disabled or no recipient email")
            return False

        subject = f"Your Order Has Been Delivered - {order_number}"
        
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
                        background-color: #0ea5e9;
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
                    .success-box {{
                        background-color: #dcfce7;
                        border-left: 4px solid #22c55e;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }}
                    .address-box {{
                        background-color: #f0f9ff;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                        border-left: 4px solid #0ea5e9;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #0ea5e9;
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
                        <h1 style="margin: 0; font-size: 28px;">✓ Order Delivered</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your package has been successfully delivered</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        
                        <p>Great news! Your order has been successfully delivered. We hope you enjoy your purchase!</p>
                        
                        <div class="success-box">
                            <h4 style="margin-top: 0; color: #166534;">Delivery Confirmed</h4>
                            <p style="margin-bottom: 0; color: #166534;"><strong>Order ID:</strong> {order_number}</p>
                        </div>
                        
                        <div class="address-box">
                            <h4 style="margin-top: 0; color: #0c4a6e;">Delivered To</h4>
                            <p style="margin-bottom: 0; color: #1e5a96;">{delivery_address}</p>
                        </div>
                        
                        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <h4 style="margin-top: 0; color: #374151;">What's Next?</h4>
                            <ul style="margin: 10px 0; padding-left: 20px; color: #555;">
                                <li>Check your package for any damage</li>
                                <li>Verify that all items are present</li>
                                <li>Contact us if you have any issues</li>
                            </ul>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            Thank you for your purchase! If you have any feedback or need assistance, please don't hesitate to contact our support team.
                        </p>
                        
                        <div style="text-align: center;">
                            <a href="{settings.FRONTEND_URL}/orders" class="btn">View All Orders</a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            Questions? Contact us at support@hurshbintech.com
                        </p>
                        
                        <p style="color: #999; font-size: 13px; margin-top: 25px;">
                            Thank you for choosing HurshBintech!
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2026 HurshBintech. All rights reserved.</p>
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
            email_type="order_delivered",
        )

    # Out of Stock Notification - Sent to ADMIN when a learning material runs out of stock
    @staticmethod
    async def send_out_of_stock_notification(
        admin_email: str,
        admin_name: str,
        product_name: str,
        product_id: str,
        previous_stock: int,
        current_stock: int,
    ) -> bool:
        """Send out-of-stock notification email to admin when a product runs out of stock"""
        
        if not settings.ENABLE_EMAIL or not admin_email:
            logger.warning(f"Email sending disabled or no admin email for out-of-stock notification")
            return False

        subject = f"⚠️ Alert: '{product_name}' is Out of Stock"
        
        # Format timestamp
        notification_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        
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
                        background-color: #fff3e0;
                    }}
                    .header {{
                        background: linear-gradient(135deg, #d32f2f 0%, #f57c00 100%);
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
                        color: #d32f2f;
                        margin: 0;
                    }}
                    p {{
                        margin: 10px 0;
                    }}
                    .alert-box {{
                        background-color: #ffebee;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 15px 0;
                        border-left: 4px solid #d32f2f;
                    }}
                    .info-box {{
                        background-color: #f5f5f5;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 15px 0;
                    }}
                    .action-box {{
                        background-color: #e8f5e9;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 15px 0;
                        border-left: 4px solid #4caf50;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #d32f2f;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 6px;
                        margin-top: 20px;
                        font-weight: 600;
                    }}
                    .stats-table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin: 15px 0;
                        background-color: #f9f9f9;
                    }}
                    .stats-table td {{
                        padding: 12px;
                        border: 1px solid #ddd;
                    }}
                    .stats-label {{
                        font-weight: 600;
                        color: #2c3e50;
                        width: 40%;
                        background-color: #f5f5f5;
                    }}
                    .stats-value {{
                        color: #555;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 26px;">⚠️ STOCK ALERT</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">A learning material has gone out of stock</p>
                    </div>
                    <div class="content">
                        <p>Hi <strong>{admin_name}</strong>,</p>
                        <p>This is an important notification: A learning material in your inventory has just gone out of stock.</p>
                        
                        <div class="alert-box">
                            <h3 style="margin-top: 0; color: #d32f2f;">🛑 Product: {product_name}</h3>
                            <p style="margin-bottom: 0; color: #c62828;"><strong>Status:</strong> Out of Stock</p>
                        </div>
                        
                        <div class="info-box">
                            <h4 style="margin-top: 0; color: #1a237e;">Stock Information</h4>
                            <table class="stats-table">
                                <tr>
                                    <td class="stats-label">Previous Stock:</td>
                                    <td class="stats-value"><strong>{previous_stock} units</strong></td>
                                </tr>
                                <tr>
                                    <td class="stats-label">Current Stock:</td>
                                    <td class="stats-value"><strong style="color: #d32f2f;">{current_stock} units</strong></td>
                                </tr>
                                <tr>
                                    <td class="stats-label">Product ID:</td>
                                    <td class="stats-value"><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">{product_id}</code></td>
                                </tr>
                                <tr>
                                    <td class="stats-label">Notification Time:</td>
                                    <td class="stats-value">{notification_time} UTC</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div class="action-box">
                            <h4 style="margin-top: 0; color: #1b5e20;">Recommended Actions</h4>
                            <ul style="margin: 10px 0; padding-left: 20px; color: #555;">
                                <li><strong>Restock Immediately:</strong> Place an order to replenish inventory</li>
                                <li><strong>Update Product Status:</strong> Mark as unavailable if restock is delayed</li>
                                <li><strong>Notify Customers:</strong> Inform waiting customers when stock will be available</li>
                                <li><strong>Review Demand:</strong> Analyze sales patterns to prevent future stockouts</li>
                            </ul>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 20px;">
                            <strong>Note:</strong> This is an automated alert from the Hurshbintech inventory management system. 
                            Please take immediate action to restock this item and resume sales.
                        </p>
                        
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="{settings.FRONTEND_URL}/admin/products" class="btn">Go to Products Dashboard</a>
                        </div>
                        
                        <div class="footer">
                            <p>This is an automated message from Hurshbintech. Please do not reply to this email.</p>
                            <p>© 2026 Hurshbintech. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
        """
        
        return await EmailService._send_email(
            recipient_email=admin_email,
            recipient_name=admin_name,
            subject=subject,
            html_body=html_body,
            email_type="out_of_stock_alert",
        )

