import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Sends an email to the driver.
    Falls back to a console/log mock if credentials are not configured.
    """
    to_clean = to_email.strip()

    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        logger.warning(
            f"[EMAIL MOCK] Credentials not set. To: {to_clean} | Subject: {subject} | Body: {body}"
        )
        return True

    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to_clean

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email successfully sent to {to_clean}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_clean}: {str(e)}")
        return False
