from __future__ import annotations

import datetime as dt
from collections import defaultdict

from icalendar import Calendar

from app.models import Event

UTC = dt.timezone.utc


def course_and_subject(summary: str) -> tuple[str, str]:
    parts = [part.strip() for part in summary.split("/") if part.strip()]
    if not parts:
        return "unknown", "unknown"
    course_parts = parts[0].split("-", 2)
    course = course_parts[1].strip() if len(course_parts) > 1 else parts[0]
    subject = parts[-1] if len(parts) > 3 else "unknown"
    return course or "unknown", subject or "unknown"


def get_location(location: str = "") -> str:
    if not location:
        return ""
    parts = [part.strip() for part in location.split("-", 1)]
    return parts[-1]


def as_utc(value: object) -> dt.datetime:
    if isinstance(value, dt.datetime):
        result = value
    elif isinstance(value, dt.date):
        result = dt.datetime.combine(value, dt.time())
    else:
        raise ValueError(f"Unsupported calendar value: {value!r}")
    return (result if result.tzinfo else result.replace(tzinfo=UTC)).astimezone(UTC)


def parse_ics(data: bytes, owner_id: int, source_key: str = "manual") -> dict[str, list[Event]]:
    try:
        calendar = Calendar.from_ical(data)
    except Exception as error:
        raise ValueError("The uploaded file is not a valid iCalendar document.") from error

    events: dict[str, list[Event]] = defaultdict(list)
    for component in calendar.walk("VEVENT"):
        start_property = component.get("dtstart")
        if start_property is None:
            continue
        start = as_utc(start_property.dt)
        end_property = component.get("dtend")
        end = as_utc(end_property.dt) if end_property else start + dt.timedelta(hours=1)
        if end <= start:
            raise ValueError("An imported event has an end before or equal to its start.")
        title = str(component.get("summary", "Untitled event"))
        course, subject = course_and_subject(title)
        event = Event(
            id=None,
            owner_id=owner_id,
            uid=str(component.get("uid", f"import-{start.isoformat()}")),
            source_key=source_key,
            course=course,
            subject=subject,
            title=title,
            start_at=start,
            end_at=end,
            location=get_location(str(component.get("location", ""))),
            description=str(component.get("description", "")),
        )
        events[course].append(event)
    return dict(events)
