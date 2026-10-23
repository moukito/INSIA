from __future__ import annotations

import datetime as dt
from collections.abc import Iterable

from fastapi.testclient import TestClient

from app.api.routes.calendar import get_repository
from app.main import app
from app.models import Event
from app.services import CalendarService
from app.integrations.ics_importer import parse_ics


class InMemoryEventRepository:
    def __init__(self) -> None:
        self.events: dict[int, Event] = {}
        self.next_id = 1
        self.choices: dict[tuple[int, str, str], bool] = {}

    def add(self, event: Event) -> int:
        event_id = self.next_id
        self.next_id += 1
        self.events[event_id] = Event(id=event_id, **{
            field: getattr(event, field)
            for field in (
                "owner_id", "uid", "source_key", "course", "subject", "title",
                "start_at", "end_at", "location", "description", "reminder_sent_at",
            )
        })
        return event_id

    def add_many(self, owner_id: int, events: Iterable[Event]) -> int:
        return sum(self.add(event) >= 0 for event in events)

    def get(self, owner_id: int, event_id: int) -> Event | None:
        event = self.events.get(event_id)
        return event if event and event.owner_id == owner_id else None

    def list_between(self, owner_id: int, start: dt.datetime | None, end: dt.datetime | None) -> list[Event]:
        return [
            event for event in sorted(self.events.values(), key=lambda item: item.start_at)
            if event.owner_id == owner_id
            and (start is None or event.start_at >= start)
            and (end is None or event.start_at < end)
        ]

    def update(self, owner_id: int, event_id: int, values: dict[str, object]) -> bool:
        current = self.get(owner_id, event_id)
        if current is None:
            return False
        self.events[event_id] = Event(id=event_id, **{
            field: values.get(field, getattr(current, field))
            for field in (
                "owner_id", "uid", "source_key", "course", "subject", "title",
                "start_at", "end_at", "location", "description", "reminder_sent_at",
            )
        })
        return True

    def delete(self, owner_id: int, event_id: int) -> bool:
        if self.get(owner_id, event_id) is None:
            return False
        del self.events[event_id]
        return True

    def course_choices(self, owner_id: int, source_key: str) -> dict[str, bool]:
        return {
            course: enabled
            for (choice_owner, choice_source, course), enabled in self.choices.items()
            if choice_owner == owner_id and choice_source == source_key
        }

    def set_course_choice(self, owner_id: int, source_key: str, course: str, enabled: bool) -> None:
        self.choices[(owner_id, source_key, course)] = enabled

    def synchronize_source(self, owner_id: int, source_key: str, events: list[Event]):
        existing = {
            event.uid: event
            for event in self.list_between(owner_id, None, None)
            if event.source_key == source_key
        }
        incoming = {event.uid: event for event in events}
        added = [event for uid, event in incoming.items() if uid not in existing]
        changed = [event for uid, event in incoming.items() if uid in existing and event != existing[uid]]
        removed = [event for uid, event in existing.items() if uid not in incoming]
        self.add_many(owner_id, added)
        for event in changed:
            assert event.id is not None
            self.update(owner_id, event.id, {
                field: getattr(event, field)
                for field in ("course", "subject", "title", "start_at", "end_at", "location", "description")
            })
        for event in removed:
            assert event.id is not None
            self.delete(owner_id, event.id)
        return added, changed, removed


ICS = b"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:course-1
DTSTART:20261023T080000Z
DTEND:20261023T100000Z
SUMMARY:INSA-MATH / Lecture / Room / Algebra
LOCATION:Building - Room 101
END:VEVENT
END:VCALENDAR
"""


def test_parse_ics_normalizes_event_fields() -> None:
    grouped = parse_ics(ICS, owner_id=7, source_key="insa")
    event = grouped["MATH"][0]

    assert event.owner_id == 7
    assert event.course == "MATH"
    assert event.subject == "Algebra"
    assert event.title == "INSA-MATH / Lecture / Room / Algebra"
    assert event.location == "Room 101"
    assert event.start_at.tzinfo == dt.timezone.utc


def test_service_rejects_invalid_event_period() -> None:
    repository = InMemoryEventRepository()
    service = CalendarService(repository)

    try:
        service.create_event(1, {
            "title": "Invalid",
            "start_at": dt.datetime(2026, 10, 23, 10, tzinfo=dt.timezone.utc),
            "end_at": dt.datetime(2026, 10, 23, 9, tzinfo=dt.timezone.utc),
        })
    except ValueError as error:
        assert str(error) == "The end must be after the start."
    else:
        raise AssertionError("Expected invalid period to be rejected")


def test_api_crud_is_scoped_to_owner() -> None:
    repository = InMemoryEventRepository()
    app.dependency_overrides[get_repository] = lambda: repository
    client = TestClient(app)
    payload = {
        "title": "Revision",
        "start_at": "2026-10-23T10:00:00Z",
        "end_at": "2026-10-23T11:00:00Z",
    }

    try:
        response = client.post("/api/calendar/events", headers={"X-Owner-ID": "1"}, json=payload)
        assert response.status_code == 201
        event_id = response.json()["id"]

        assert client.get(
            f"/api/calendar/events/{event_id}", headers={"X-Owner-ID": "2"}
        ).status_code == 404
        assert client.get(
            f"/api/calendar/events/{event_id}", headers={"X-Owner-ID": "1"}
        ).json()["title"] == "Revision"
    finally:
        app.dependency_overrides.clear()
