import json
import os
from pathlib import Path
from typing import List
from urllib.parse import quote_plus

import boto3

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

SECRET_NAME = os.getenv(
    "DATABASE_SECRET_NAME",
    "fleetflow/production/database",
)


def _load_database_secret() -> None:
    try:
        client = boto3.client("secretsmanager")
        response = client.get_secret_value(SecretId=SECRET_NAME)
        secret = json.loads(response["SecretString"])

        username = secret["username"]
        password = secret["password"]
        host = secret["host"]
        port = secret["port"]
        database = os.getenv(
            "DATABASE_NAME",
            secret.get("database", "fleetflow"),
        )

        os.environ["DATABASE_URL"] = (
            f"postgresql+psycopg://{quote_plus(username)}:"
            f"{quote_plus(password)}@{host}:{port}/{database}"
        )

    except Exception as exc:
        print(f"Warning: Could not load database secret: {exc}")


def _load_dotenv(path: Path | None = None) -> None:
    env_path = path or ENV_FILE

    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        os.environ[key] = value


_load_dotenv()
_load_database_secret()


class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_NAME: str = os.getenv("APP_NAME", "FleetFlow")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./app.db",
    )

    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "replace-with-a-secure-random-secret",
    )

    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")

    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )

    TWILIO_ACCOUNT_SID: str | None = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: str | None = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_FROM_NUMBER: str | None = os.getenv("TWILIO_FROM_NUMBER")

    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")

    SPEED_LIMIT_THRESHOLD: float = float(os.getenv("SPEED_LIMIT_THRESHOLD", "60.0"))

    RECONCILE_GPS_RATIO_LIMIT: float = float(
        os.getenv("RECONCILE_GPS_RATIO_LIMIT", "1.20")
    )

    RECONCILE_ODO_GPS_DIFF_LIMIT: float = float(
        os.getenv("RECONCILE_ODO_GPS_DIFF_LIMIT", "5.0")
    )

    RECONCILE_ODO_GPS_PCT_LIMIT: float = float(
        os.getenv("RECONCILE_ODO_GPS_PCT_LIMIT", "0.05")
    )

    RECONCILE_ODO_PLAN_DIFF_LIMIT: float = float(
        os.getenv("RECONCILE_ODO_PLAN_DIFF_LIMIT", "10.0")
    )

    RECONCILE_ODO_PLAN_PCT_LIMIT: float = float(
        os.getenv("RECONCILE_ODO_PLAN_PCT_LIMIT", "0.10")
    )

    MANDATORY_SAFETY_INSPECTION: bool = (
        os.getenv("MANDATORY_SAFETY_INSPECTION", "true").lower() == "true"
    )

    SMTP_HOST: str | None = os.getenv("SMTP_HOST")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str | None = os.getenv("SMTP_USER")
    SMTP_PASSWORD: str | None = os.getenv("SMTP_PASSWORD")

    EMAIL_FROM: str = os.getenv(
        "EMAIL_FROM",
        "noreply@fleetflow.com",
    )

    @property
    def cors_origins(self) -> List[str]:
        raw_value = os.getenv("CORS_ORIGINS", "*")

        if raw_value.strip() == "*":
            return ["*"]

        return [item.strip() for item in raw_value.split(",") if item.strip()]


settings = Settings()
