from __future__ import annotations

import datetime as dt
import uuid
from dataclasses import replace
from dataclasses import dataclass

import httpx

from app.integrations.ics_importer import parse_ics
from app.models import Event
from app.repositories import EventRepository


@dataclass(frozen=True, slots=True)
class SyncChanges:
    source: str
    added: list[Event]
    changed: list[Event]
    removed: list[Event]
    unknown_courses: list[str]


class CalendarService:
    def __init__(self, repository: EventRepository) -> None:
        self.repository = repository

    def create_event(self, owner_id: int, values: dict[str, object]) -> Event:
        start_at = values.get("start_at")
        end_at = values.get("end_at")
        if not isinstance(start_at, dt.datetime) or not isinstance(end_at, dt.datetime):
            raise ValueError("Event start_at and end_at must be datetimes.")
        if end_at <= start_at:
            raise ValueError("The end must be after the start.")
        event = Event(
            id=None,
            owner_id=owner_id,
            uid=f"manual-{uuid.uuid4()}",
            source_key="manual",
            course=str(values.get("course", "Personal")),
            subject=str(values.get("subject", "unknown")),
            title=str(values["title"]),
            start_at=start_at,
            end_at=end_at,
            location=str(values.get("location", "")),
            description=str(values.get("description", "")),
        )
        event_id = self.repository.add(event)
        return replace(event, id=event_id)

    def list_events(self, owner_id: int, start: dt.datetime | None, end: dt.datetime | None) -> list[Event]:
        return self.repository.list_between(owner_id, start, end)

    def get_event(self, owner_id: int, event_id: int) -> Event | None:
        return self.repository.get(owner_id, event_id)

    def update_event(self, owner_id: int, event_id: int, values: dict[str, object]) -> Event | None:
        current = self.repository.get(owner_id, event_id)
        if current is None:
            return None
        start_at = values.get("start_at", current.start_at)
        end_at = values.get("end_at", current.end_at)
        if not isinstance(start_at, dt.datetime) or not isinstance(end_at, dt.datetime):
            raise ValueError("Event start_at and end_at must be datetimes.")
        if end_at <= start_at:
            raise ValueError("The end must be after the start.")
        self.repository.update(owner_id, event_id, values)
        return self.repository.get(owner_id, event_id)

    def delete_event(self, owner_id: int, event_id: int) -> bool:
        return self.repository.delete(owner_id, event_id)

    def import_ics(self, owner_id: int, source_key: str, data: bytes) -> tuple[int, list[str]]:
        grouped = parse_ics(data, owner_id, source_key)
        events = [event for course_events in grouped.values() for event in course_events]
        return self.repository.add_many(owner_id, events), sorted(grouped)

    async def synchronize(self, owner_id: int, source_key: str, url: str) -> SyncChanges | None:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.content
        grouped = parse_ics(data, owner_id, source_key)
        choices = self.repository.course_choices(owner_id, source_key)
        unknown_courses = sorted(set(grouped) - set(choices))
        if unknown_courses:
            return SyncChanges(source_key, [], [], [], unknown_courses)
        events = [event for course_events in grouped.values() for event in course_events]
        added, changed, removed = self.repository.synchronize_source(owner_id, source_key, events)
        return SyncChanges(source_key, added, changed, removed, [])
