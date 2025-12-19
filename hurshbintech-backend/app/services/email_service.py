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

        subject = "✓ Appointment Confirmed"
        
        session_info = ""
        if session_type:
            session_type_display = session_type.replace('_', ' ').title()
            session_info = f"<p><strong>Session Type:</strong> {session_type_display}</p>"
        
        html_body = f"""
        <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; color: white; text-align: center; }}
                    .content {{ background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                    .details-box {{ background-color: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }}
                    .detail-item {{ margin: 10px 0; }}
                    .detail-label {{ font-weight: 600; color: #667eea; }}
                    .detail-value {{ color: #555; margin-left: 10px; }}
                    .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }}
                    .btn {{ display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }}
                    h2 {{ color: #667eea; margin: 0; }}
                    p {{ margin: 10px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 28px;">✓ Appointment Confirmed!</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your booking is all set</p>
                    </div>
                    
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        
                        <p>Great news! Your appointment request has been <strong>confirmed</strong> and is ready to go.</p>
                        
                        <div class="details-box">
                            <h3 style="margin-top: 0; color: #667eea;">Appointment Details:</h3>
                            <div class="detail-item">
                                <span class="detail-label">Coach:</span>
                                <span>{coach_name}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Date:</span>
                                <span>{scheduled_date}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Time:</span>
                                <span>{scheduled_time}</span>
                            </div>
                            {session_info}
                            <div class="detail-item" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                                <span class="detail-label">Reference ID:</span>
                                <span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">#{appointment_id}</span>
                            </div>
                        </div>
                        
                        <p><strong>Next Steps:</strong></p>
                        <ul style="color: #555;">
                            <li>Make sure to join the session on time</li>
                            <li>Have all necessary materials ready</li>
                            <li>If you need to reschedule, contact your coach as soon as possible</li>
                        </ul>
                        
                        <p style="color: #666; font-size: 14px;">If you have any questions about your appointment, please reach out to <strong>{coach_name}</strong> or our support team.</p>
                        
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

        subject = "✗ Appointment Not Confirmed"
        
        reason_text = rejection_reason or "We were unable to accommodate this appointment at this time."
        
        html_body = f"""
        <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }}
                    .header {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 8px 8px 0 0; color: white; text-align: center; }}
                    .content {{ background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                    .details-box {{ background-color: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5576c; }}
                    .reason-box {{ background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #ffc107; }}
                    .detail-item {{ margin: 10px 0; }}
                    .detail-label {{ font-weight: 600; color: #666; }}
                    .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }}
                    h2 {{ color: #f5576c; margin: 0; }}
                    p {{ margin: 10px 0; }}
                    .next-steps {{ background-color: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #4caf50; }}
                    .next-steps strong {{ color: #2e7d32; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 28px;">✗ Appointment Update</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your booking status has changed</p>
                    </div>
                    
                    <div class="content">
                        <p>Hi <strong>{recipient_name}</strong>,</p>
                        
                        <p>We're writing to inform you that your appointment request with <strong>{coach_name}</strong> could not be confirmed at this time.</p>
                        
                        <div class="details-box">
                            <h3 style="margin-top: 0; color: #d32f2f;">Appointment Details:</h3>
                            <div class="detail-item">
                                <span class="detail-label">Coach:</span>
                                <span>{coach_name}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Requested Date:</span>
                                <span>{scheduled_date}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Requested Time:</span>
                                <span>{scheduled_time}</span>
                            </div>
                            <div class="detail-item" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                                <span class="detail-label">Reference ID:</span>
                                <span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">#{appointment_id}</span>
                            </div>
                        </div>
                        
                        <div class="reason-box">
                            <h4 style="margin-top: 0; color: #f5576c;">Reason for Rejection:</h4>
                            <p style="margin-bottom: 0; color: #555;">{reason_text}</p>
                        </div>
                        
                        <div class="next-steps">
                            <strong style="display: block; margin-bottom: 8px;">What You Can Do:</strong>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Try scheduling another appointment at a different time</li>
                                <li>Request an appointment with a different coach</li>
                                <li>Contact support if you have any questions or concerns</li>
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
