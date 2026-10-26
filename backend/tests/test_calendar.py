from __future__ import annotations

import datetime as dt
from collections.abc import Iterable
from pathlib import Path

from fastapi.testclient import TestClient
from icalendar import Calendar

from app.api.routes.calendar import get_repository
from app.integrations.ics_importer import parse_ics
from app.main import app
from app.models import Event
from app.services import CalendarService


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


ICS_ADE = """BEGIN:VCALENDAR
METHOD:REQUEST
PRODID:-//ADE/version 6.0
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTAMP:20261006T130450Z
DTSTART:20261202T070000Z
DTEND:20261202T090000Z
SUMMARY:HU:0:S1::S-SERIE2:TD::SERIE2-OPT16 #007
LOCATION:0304-01-04
DESCRIPTION:\n[HU-0-S1-EC-S-SERIE2:TD] Options Sciences Humaines et Socia
 les\, S1 Série 2\n()\n\nHU:0:S1::S-SERIE2:TD::SERIE2-OPT16\nCOLMARS Juli
 en\n\n(Exporté le:06/10/2026 15:04)\n\n
UID:ADE604144455f494e53415f323032362d323032372d37303736332d302d30
CREATED:19700101T000000Z
LAST-MODIFIED:20261006T130450Z
SEQUENCE:2142505004
END:VEVENT
END:VCALENDAR
"""

ICS_TC = """BEGIN:VCALENDAR
PRODID:-//EDT//NONSGML v1.0//EN
VERSION:2.0
X-WR-CALNAME:Telecom-Promo-5/G1
X-WR-TIMEZONE:Europe/Paris
X-WR-CALDESC:Agenda Telecom Promo-5/G1
CALSCALE:GREGORIAN
BEGIN:VTIMEZONE
TZID:Europe/Paris
X-LIC-LOCATION:Europe/Paris
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=10
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
DTSTAMP:20260919T080002Z
UID:13c9362580b012ead03eaeb99584cf58
AALARM:20260921T080000
CATEGORIES:APPOINTMENT
DALARM:20260921T080000
CLASS:PUBLIC
LOCATION:2-TD B
DTSTART;TZID=Europe/Paris:20260921T080000
DTEND;TZID=Europe/Paris:20260921T100000
SUMMARY:5TC-DMO-2026/2_TD/5TC-G1/
DESCRIPTION:MMI, SMR
END:VEVENT
END:VCALENDAR
"""


def test_parse_ics_normalizes_event_fields_ade() -> None:
    grouped = parse_ics(ICS_ADE, owner_id=7, source_key="ade")
    print(grouped)
    event = grouped["SERIE2:TD::SERIE2"][0]

    assert event.owner_id == 7
    assert event.course == "SERIE2:TD::SERIE2"
    assert event.subject == "unknown"
    assert event.title == "HU:0:S1::S-SERIE2:TD::SERIE2-OPT16 #007"
    assert event.location == "01-04"
    assert event.start_at.tzinfo == dt.timezone.utc


def test_parse_ics_normalizes_event_fields_tc() -> None:
    grouped = parse_ics(ICS_TC, owner_id=7, source_key="tc")
    event = grouped["DMO"][0]

    assert event.owner_id == 7
    assert event.course == "DMO"
    assert event.subject == "unknown"
    assert event.title == "5TC-DMO-2026/2_TD/5TC-G1/"
    assert event.location == "TD B"
    assert event.start_at.tzinfo == dt.timezone.utc


def test_all_ics_fixtures_import_every_supported_event_field() -> None:
    fixture_dir = Path(__file__).parents[1] / ".debug"
    fixture_paths = sorted(fixture_dir.glob("*.ics")) + sorted(fixture_dir.glob("*.ical"))

    assert fixture_paths, "Expected calendar fixtures in .debug/"

    for fixture_path in fixture_paths:
        data = fixture_path.read_bytes()
        source_key = fixture_path.stem
        imported = parse_ics(data, owner_id=42, source_key=source_key)
        imported_events = [
            event for course_events in imported.values() for event in course_events
        ]
        source_events = list(Calendar.from_ical(data).walk("VEVENT"))

        assert len(imported_events) == len(source_events), fixture_path.name
        assert sum(len(events) for events in imported.values()) == len(source_events)

        imported_by_uid = {event.uid: event for event in imported_events}
        assert len(imported_by_uid) == len(imported_events), fixture_path.name

        for source_event in source_events:
            uid = str(source_event["uid"])
            event = imported_by_uid[uid]
            start = source_event["dtstart"].dt
            end = source_event["dtend"].dt
            expected_start = start.replace(tzinfo=dt.timezone.utc) if start.tzinfo is None else start.astimezone(dt.timezone.utc)
            expected_end = end.replace(tzinfo=dt.timezone.utc) if end.tzinfo is None else end.astimezone(dt.timezone.utc)

            assert event.owner_id == 42
            assert event.source_key == source_key
            assert event.uid == uid
            assert event.title == str(source_event["summary"])
            assert event.description == str(source_event.get("description", ""))
            assert event.start_at == expected_start
            assert event.end_at == expected_end

            source_location = str(source_event.get("location", ""))
            expected_location = source_location.split("-", 1)[-1].strip() if source_location else ""
            assert event.location == expected_location
            assert event.course in imported
            assert event in imported[event.course]


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
