from __future__ import annotations

import datetime as dt
import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    """Application settings loaded from environment variables."""

    database_url: str
    ics_sources: dict[str, str]
    timezone: ZoneInfo
    reminder_minutes: int
    sync_time: dt.time
    weekly_schedule_time: dt.time
    meteo_evening_time: dt.time
    default_meteo_location: str
    default_latitude: float
    default_longitude: float
    command_guild_id: int | None = None

    @classmethod
    def from_environment(cls) -> Settings:
        load_dotenv()
        timezone = _parse_timezone(os.getenv("SYNC_TIMEZONE", "Europe/Paris"))
        return cls(
            database_url=os.getenv("DATABASE_URL", ""),
            ics_sources=_parse_sources(os.getenv("ICS_SOURCES", "")),
            command_guild_id=_parse_optional_int(os.getenv("COMMAND_GUILD_ID")),
            reminder_minutes=int(os.getenv("REMINDER_MINUTES", "30")),
            timezone=timezone,
            sync_time=_parse_sync_time(os.getenv("SYNC_TIME", "07:00"), timezone),
            weekly_schedule_time=_parse_sync_time(
                os.getenv("WEEKLY_SCHEDULE_TIME", "12:00"), timezone
            ),
            meteo_evening_time=_parse_sync_time(
                os.getenv("METEO_EVENING_TIME", "20:00"), timezone
            ),
            default_meteo_location=os.getenv(
                "DEFAULT_METEO_LOCATION", "Villeurbanne, France"
            ),
            default_latitude=float(os.getenv("DEFAULT_METEO_LATITUDE", "45.7719")),
            default_longitude=float(os.getenv("DEFAULT_METEO_LONGITUDE", "4.8902")),
        )


def _parse_sources(value: str) -> dict[str, str]:
    sources: dict[str, str] = {}
    for item in value.split(","):
        if not item.strip():
            continue
        try:
            name, url = item.split("=", 1)
        except ValueError as error:
            raise ValueError("ICS_SOURCES must use name=url pairs separated by commas") from error
        sources[name.strip()] = url.strip()
    return sources


def _parse_optional_int(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        return int(value)
    except ValueError as error:
        raise ValueError("COMMAND_GUILD_ID must be a Discord server ID") from error


def _parse_timezone(value: str) -> ZoneInfo:
    try:
        return ZoneInfo(value)
    except (ValueError, TypeError, KeyError) as error:
        raise ValueError(
            "SYNC_TIMEZONE must be a valid IANA timezone"
        ) from error


def _parse_sync_time(value: str, timezone: ZoneInfo) -> dt.time:
    try:
        hour, minute = (int(part) for part in value.split(":", 1))
        return dt.time(hour=hour, minute=minute, tzinfo=timezone)
    except (ValueError, TypeError) as error:
        raise ValueError("SYNC_TIME must use HH:MM format") from error
