import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def get_now_ist() -> datetime.datetime:
    """
    Returns the current time in Indian Standard Time (IST) as a timezone-aware datetime.
    """
    return datetime.datetime.now(IST)


def get_now_ist_naive() -> datetime.datetime:
    """
    Returns the current time in Indian Standard Time (IST) as a timezone-naive datetime.
    """
    return datetime.datetime.now(IST).replace(tzinfo=None)
