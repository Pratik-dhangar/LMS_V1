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
