"""
Test Brevo API configuration and sender email verification
"""
import asyncio
import aiohttp
from app.core.config import settings

async def test_brevo_config():
    """Test Brevo API key and check sender verification status"""
    
    print("=" * 60)
    print("BREVO EMAIL CONFIGURATION TEST")
    print("=" * 60)
    
    # Check environment variables
    print(f"\n1. Environment Variables:")
    print(f"   BREVO_API_KEY: {'✓ Set' if settings.BREVO_API_KEY else '✗ NOT SET'}")
    print(f"   SENDER_EMAIL: {settings.SENDER_EMAIL}")
    print(f"   SENDER_NAME: {settings.SENDER_NAME}")
    print(f"   ENABLE_EMAIL: {settings.ENABLE_EMAIL}")
    
    if not settings.BREVO_API_KEY:
        print("\n✗ ERROR: BREVO_API_KEY is not set in .env file!")
        return
    
    # Test API connectivity
    print(f"\n2. Testing Brevo API Connection...")
    
    headers = {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            # Check account info
            async with session.get(
                "https://api.brevo.com/v3/account",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    account_data = await response.json()
                    print(f"   ✓ API Key Valid!")
                    print(f"   Account Email: {account_data.get('email', 'N/A')}")
                else:
                    error_text = await response.text()
                    print(f"   ✗ API Error (Status {response.status}): {error_text}")
                    return
            
            # Check senders list
            print(f"\n3. Checking Verified Senders...")
            async with session.get(
                "https://api.brevo.com/v3/senders",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    senders_data = await response.json()
                    senders = senders_data.get('senders', [])
                    
                    if not senders:
                        print(f"   ✗ NO VERIFIED SENDERS FOUND!")
                        print(f"\n   ACTION REQUIRED:")
                        print(f"   1. Go to: https://app.brevo.com/senders")
                        print(f"   2. Add sender: {settings.SENDER_EMAIL}")
                        print(f"   3. Verify the sender email")
                        return
                    
                    print(f"   Found {len(senders)} sender(s):")
                    sender_found = False
                    for sender in senders:
                        email = sender.get('email', 'N/A')
                        is_active = sender.get('active', False)
                        status_icon = '✓' if is_active else '✗'
                        status_text = 'VERIFIED' if is_active else 'NOT VERIFIED'
                        print(f"   {status_icon} {email} - {status_text}")
                        
                        if email.lower() == settings.SENDER_EMAIL.lower() and is_active:
                            sender_found = True
                    
                    if not sender_found:
                        print(f"\n   ⚠ WARNING: Your configured sender '{settings.SENDER_EMAIL}' is NOT in the verified list!")
                        print(f"\n   ACTION REQUIRED:")
                        print(f"   1. Go to: https://app.brevo.com/senders")
                        print(f"   2. Add and verify: {settings.SENDER_EMAIL}")
                        print(f"   OR")
                        print(f"   3. Update SENDER_EMAIL in .env to use one of the verified emails above")
                        return
                    else:
                        print(f"\n   ✓ Sender email '{settings.SENDER_EMAIL}' is VERIFIED and ready to use!")
                else:
                    error_text = await response.text()
                    print(f"   ✗ Failed to check senders (Status {response.status}): {error_text}")
                    return
            
            # Try sending a test email
            print(f"\n4. Sending Test Email...")
            test_email = input(f"   Enter recipient email to test (or press Enter to skip): ").strip()
            
            if test_email:
                payload = {
                    "sender": {
                        "name": settings.SENDER_NAME,
                        "email": settings.SENDER_EMAIL
                    },
                    "to": [
                        {
                            "email": test_email,
                            "name": "Test User"
                        }
                    ],
                    "subject": "Test Email from Hurshbintech",
                    "htmlContent": """
                        <html>
                        <body>
                            <h2>✓ Email Configuration Test</h2>
                            <p>This is a test email from your Hurshbintech application.</p>
                            <p>If you received this, your email configuration is working correctly!</p>
                        </body>
                        </html>
                    """
                }
                
                async with session.post(
                    "https://api.brevo.com/v3/smtp/email",
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 201:
                        response_data = await response.json()
                        message_id = response_data.get("messageId", "unknown")
                        print(f"   ✓ Test email sent successfully!")
                        print(f"   MessageID: {message_id}")
                        print(f"\n   Check your inbox (and spam folder) at: {test_email}")
                    else:
                        error_text = await response.text()
                        print(f"   ✗ Failed to send test email (Status {response.status})")
                        print(f"   Error: {error_text}")
            else:
                print(f"   Skipped test email")
    
    except Exception as e:
        print(f"   ✗ Error: {str(e)}")
        return
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_brevo_config())
