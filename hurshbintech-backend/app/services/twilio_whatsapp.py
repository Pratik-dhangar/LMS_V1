"""
Twilio WhatsApp Service
Handles sending WhatsApp notifications (text or templates) using Twilio.
"""

import json
import logging
import httpx
from typing import Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

class TwilioWhatsAppService:
    """
    Service for sending WhatsApp messages via Twilio API.
    Uses async httpx client to communicate directly without blocking the main event loop.
    """

    @staticmethod
    def _format_whatsapp_number(number: str) -> str:
        """
        Ensures the number is prefixed with 'whatsapp:' and formatted correctly.
        """
        clean_number = number.strip()
        if not clean_number.startswith("whatsapp:"):
            # Ensure there is a plus sign if it doesn't exist
            if not clean_number.startswith("+"):
                clean_number = f"+{clean_number}"
            return f"whatsapp:{clean_number}"
        return clean_number

    @classmethod
    async def send_text_message(cls, to_number: str, body: str) -> Dict[str, Any]:
        """
        Send a raw text WhatsApp message.
        
        Args:
            to_number: Recipient's phone number (with or without 'whatsapp:' prefix)
            body: The text message content
            
        Returns:
            Dict containing status, response data or error details.
        """
        if not settings.ENABLE_TWILIO_WHATSAPP:
            logger.info("Twilio WhatsApp is disabled. Skipping sending message.")
            return {"status": "skipped", "reason": "disabled"}

        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.error("Twilio credentials are missing in configuration.")
            return {"status": "failed", "reason": "missing_credentials"}

        if not settings.TWILIO_WHATSAPP_FROM_NUMBER:
            logger.error("Twilio Sender WhatsApp Number is missing in configuration.")
            return {"status": "failed", "reason": "missing_from_number"}

        to_formatted = cls._format_whatsapp_number(to_number)
        from_formatted = cls._format_whatsapp_number(settings.TWILIO_WHATSAPP_FROM_NUMBER)

        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        
        data = {
            "To": to_formatted,
            "From": from_formatted,
            "Body": body
        }

        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        try:
            async with httpx.AsyncClient() as client:
                logger.info(f"Sending WhatsApp text message to {to_formatted} via Twilio...")
                response = await client.post(url, data=data, auth=auth, timeout=10.0)
                
                if response.status_code in [200, 201]:
                    response_json = response.json()
                    logger.info(f"WhatsApp message successfully sent. Message SID: {response_json.get('sid')}")
                    return {"status": "success", "sid": response_json.get("sid")}
                else:
                    logger.error(f"Failed to send WhatsApp message. Status: {response.status_code}. Response: {response.text}")
                    return {
                        "status": "failed",
                        "status_code": response.status_code,
                        "error_message": response.text
                    }
        except Exception as e:
            logger.exception(f"Exception occurred while sending WhatsApp message: {str(e)}")
            return {"status": "failed", "error": str(e)}

    @classmethod
    async def send_template_message(
        cls, 
        to_number: str, 
        content_sid: str, 
        content_variables: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Send a Twilio Content Template WhatsApp message.
        
        Args:
            to_number: Recipient's phone number (with or without 'whatsapp:' prefix)
            content_sid: The Twilio Content SID (e.g. HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
            content_variables: Dictionary of variables for the template (e.g. {"1": "Val1"})
            
        Returns:
            Dict containing status, response data or error details.
        """
        if not settings.ENABLE_TWILIO_WHATSAPP:
            logger.info("Twilio WhatsApp is disabled. Skipping sending template message.")
            return {"status": "skipped", "reason": "disabled"}

        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.error("Twilio credentials are missing in configuration.")
            return {"status": "failed", "reason": "missing_credentials"}

        if not settings.TWILIO_WHATSAPP_FROM_NUMBER:
            logger.error("Twilio Sender WhatsApp Number is missing in configuration.")
            return {"status": "failed", "reason": "missing_from_number"}

        to_formatted = cls._format_whatsapp_number(to_number)
        from_formatted = cls._format_whatsapp_number(settings.TWILIO_WHATSAPP_FROM_NUMBER)

        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        
        # Twilio API requires ContentVariables to be a JSON string
        content_vars_json = json.dumps(content_variables)
        
        data = {
            "To": to_formatted,
            "From": from_formatted,
            "ContentSid": content_sid,
            "ContentVariables": content_vars_json
        }

        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        try:
            async with httpx.AsyncClient() as client:
                logger.info(f"Sending WhatsApp template message ({content_sid}) to {to_formatted} via Twilio...")
                response = await client.post(url, data=data, auth=auth, timeout=10.0)
                
                if response.status_code in [200, 201]:
                    response_json = response.json()
                    logger.info(f"WhatsApp template message successfully sent. Message SID: {response_json.get('sid')}")
                    return {"status": "success", "sid": response_json.get("sid")}
                else:
                    logger.error(f"Failed to send WhatsApp template message. Status: {response.status_code}. Response: {response.text}")
                    return {
                        "status": "failed",
                        "status_code": response.status_code,
                        "error_message": response.text
                    }
        except Exception as e:
            logger.exception(f"Exception occurred while sending WhatsApp template message: {str(e)}")
            return {"status": "failed", "error": str(e)}
