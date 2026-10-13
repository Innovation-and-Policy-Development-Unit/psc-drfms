"""When backups are due. Pure functions of the settings and the clock, so they are easy to test."""
from datetime import timedelta

from .models import Frequency

MAX_LOOKBACK_DAYS = 8


def _slot(now, days, hour):
    return (now + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)


def _matches(cfg, slot):
    return cfg.frequency == Frequency.DAILY or slot.weekday() == cfg.weekday


def latest_slot(cfg, now):
    """The most recent scheduled time that is not in the future."""
    for days in range(0, -MAX_LOOKBACK_DAYS, -1):
        slot = _slot(now, days, cfg.run_hour)
        if slot <= now and _matches(cfg, slot):
            return slot
    return None


def next_slot(cfg, now):
    for days in range(0, MAX_LOOKBACK_DAYS):
        slot = _slot(now, days, cfg.run_hour)
        if slot > now and _matches(cfg, slot):
            return slot
    return None


def period(cfg):
    return timedelta(days=1 if cfg.frequency == Frequency.DAILY else 7)


# How long past its period a backup may be before administrators are told it is overdue.
OVERDUE_GRACE = timedelta(hours=24)
