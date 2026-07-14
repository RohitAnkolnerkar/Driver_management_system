import logging

from twilio.rest import Client

from app.config import settings

logger = logging.getLogger(__name__)


def send_sms(to_phone: str, message: str) -> bool:
    """
    Sends an SMS message using Twilio.
    Falls back to a console/log mock if credentials are not configured.
    """
    # Normalize phone number to ensure it has +91 prefix
    phone_clean = to_phone.strip()
    if not phone_clean.startswith("+"):
        if phone_clean.startswith("91"):
            phone_clean = f"+{phone_clean}"
        else:
            phone_clean = f"+91{phone_clean}"

    if not (
        settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_FROM_NUMBER
    ):
        logger.warning(
            f"[SMS MOCK] Credentials not set. To: {phone_clean} | Message: {message}"
        )
        return True

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message, from_=settings.TWILIO_FROM_NUMBER, to=phone_clean
        )
        logger.info(f"SMS successfully sent to {phone_clean}")
        return True
    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_clean}: {str(e)}")
        return False
