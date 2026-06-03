import asyncio
import os
import sys

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.services.twilio_whatsapp import TwilioWhatsAppService

async def test_config():
    print("=== Twilio Configuration Test ===")
    print(f"ENABLE_TWILIO_WHATSAPP: {settings.ENABLE_TWILIO_WHATSAPP}")
    print(f"TWILIO_ACCOUNT_SID: {settings.TWILIO_ACCOUNT_SID}")
    print(f"TWILIO_AUTH_TOKEN: {'******' if settings.TWILIO_AUTH_TOKEN else None}")
    print(f"TWILIO_WHATSAPP_FROM_NUMBER: {settings.TWILIO_WHATSAPP_FROM_NUMBER}")
    print(f"TWILIO_WHATSAPP_TEMPLATE_SID: {settings.TWILIO_WHATSAPP_TEMPLATE_SID}")
    
    # If the user has enabled WhatsApp, let's run a test send if recipient is provided as CLI arg
    if len(sys.argv) > 1:
        recipient = sys.argv[1]
        print(f"\nAttempting to send a test message to: {recipient}")
        result = await TwilioWhatsAppService.send_text_message(
            to_number=recipient,
            body="Hello! This is a test message from your HurshbinTech Twilio WhatsApp integration setup."
        )
        print(f"Result: {result}")
    else:
        print("\nTo test sending a live message, run: python test_twilio_setup.py <recipient_phone_number>")

if __name__ == "__main__":
    asyncio.run(test_config())
