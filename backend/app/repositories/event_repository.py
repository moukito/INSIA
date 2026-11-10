from __future__ import annotations

import datetime as dt
from collections.abc import Iterable
from contextlib import closing
from typing import Protocol

from app.models import Event


class EventRepository(Protocol):
    def add(self, event: Event) -> int: ...
    def add_many(self, owner_id: int, events: Iterable[Event]) -> int: ...
    def get(self, owner_id: int, event_id: int) -> Event | None: ...
    def list_between(self, owner_id: int, start: dt.datetime | None, end: dt.datetime | None) -> list[Event]: ...
    def update(self, owner_id: int, event_id: int, values: dict[str, object]) -> bool: ...
    def delete(self, owner_id: int, event_id: int) -> bool: ...
    def course_choices(self, owner_id: int, source_key: str) -> dict[str, bool]: ...
    def set_course_choice(self, owner_id: int, source_key: str, course: str, enabled: bool) -> None: ...
    def synchronize_source(self, owner_id: int, source_key: str, events: list[Event]) -> tuple[list[Event], list[Event], list[Event]]: ...


class PostgresEventRepository:
    """PostgreSQL implementation of the calendar repository."""

    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise RuntimeError("DATABASE_URL is required")
        import psycopg
        from psycopg.rows import dict_row

        self._psycopg = psycopg
        self._dict_row = dict_row
        self.database_url = database_url
        self._initialize()

    def _connect(self):
        return self._psycopg.connect(self.database_url, row_factory=self._dict_row)

    def _initialize(self) -> None:
        with closing(self._connect()) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    owner_id BIGINT NOT NULL,
                    uid TEXT NOT NULL,
                    source_key TEXT NOT NULL DEFAULT 'manual',
                    course TEXT NOT NULL,
                    subject TEXT NOT NULL DEFAULT 'unknown',
                    title TEXT NOT NULL,
                    start_at TIMESTAMPTZ NOT NULL,
                    end_at TIMESTAMPTZ NOT NULL,
                    location TEXT NOT NULL DEFAULT '',
                    description TEXT NOT NULL DEFAULT '',
                    reminder_sent_at TIMESTAMPTZ,
                    UNIQUE(owner_id, uid, start_at)
                );
                CREATE TABLE IF NOT EXISTS course_choices (
                    owner_id BIGINT NOT NULL,
                    source_key TEXT NOT NULL,
                    course TEXT NOT NULL,
                    enabled BOOLEAN NOT NULL,
                    PRIMARY KEY(owner_id, source_key, course)
                );
                """
            )
            connection.commit()

    @staticmethod
    def _to_event(row: dict) -> Event:
        return Event(
            id=int(row["id"]),
            owner_id=int(row["owner_id"]),
            uid=row["uid"],
            source_key=row["source_key"],
            course=row["course"],
            subject=row["subject"],
            title=row["title"],
            start_at=row["start_at"],
            end_at=row["end_at"],
            location=row["location"],
            description=row["description"],
            reminder_sent_at=row["reminder_sent_at"],
        )

    def add(self, event: Event) -> int:
        with closing(self._connect()) as connection:
            row = connection.execute(
                """
                INSERT INTO events
                    (owner_id, uid, source_key, course, subject, title, start_at, end_at, location, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (event.owner_id, event.uid, event.source_key, event.course, event.subject,
                 event.title, event.start_at, event.end_at, event.location, event.description),
            ).fetchone()
            connection.commit()
            return int(row["id"])

    def add_many(self, owner_id: int, events: Iterable[Event]) -> int:
        rows = [
            (
                owner_id, event.uid, event.source_key, event.course, event.subject,
                event.title, event.start_at, event.end_at, event.location, event.description,
            )
            for event in events
        ]
        if not rows:
            return 0
        with closing(self._connect()) as connection:
            connection.executemany(
                """
                INSERT INTO events
                    (owner_id, uid, source_key, course, subject, title, start_at, end_at, location, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT(owner_id, uid, start_at) DO UPDATE SET
                    source_key = EXCLUDED.source_key,
                    course = EXCLUDED.course,
                    subject = EXCLUDED.subject,
                    title = EXCLUDED.title,
                    end_at = EXCLUDED.end_at,
                    location = EXCLUDED.location,
                    description = EXCLUDED.description,
                    reminder_sent_at = NULL
                """,
                rows,
            )
            connection.commit()
        return len(rows)

    def get(self, owner_id: int, event_id: int) -> Event | None:
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT * FROM events WHERE owner_id = %s AND id = %s", (owner_id, event_id)
            ).fetchone()
            return self._to_event(row) if row else None

    def list_between(self, owner_id: int, start: dt.datetime | None, end: dt.datetime | None) -> list[Event]:
        clauses = ["owner_id = %s"]
        params: list[object] = [owner_id]
        if start is not None:
            clauses.append("start_at >= %s")
            params.append(start)
        if end is not None:
            clauses.append("start_at < %s")
            params.append(end)
        with closing(self._connect()) as connection:
            rows = connection.execute(
                f"SELECT * FROM events WHERE {' AND '.join(clauses)} ORDER BY start_at", params
            )
            return [self._to_event(row) for row in rows]

    def update(self, owner_id: int, event_id: int, values: dict[str, object]) -> bool:
        if not values:
            return self.get(owner_id, event_id) is not None
        allowed = {"title", "start_at", "end_at", "course", "subject", "location", "description"}
        if not set(values).issubset(allowed):
            raise ValueError("Unsupported event field")
        assignments = ", ".join(f"{key} = %s" for key in values)
        with closing(self._connect()) as connection:
            cursor = connection.execute(
                f"UPDATE events SET {assignments} WHERE owner_id = %s AND id = %s",
                [*values.values(), owner_id, event_id],
            )
            connection.commit()
            return cursor.rowcount == 1

    def delete(self, owner_id: int, event_id: int) -> bool:
        with closing(self._connect()) as connection:
            cursor = connection.execute(
                "DELETE FROM events WHERE owner_id = %s AND id = %s", (owner_id, event_id)
            )
            connection.commit()
            return cursor.rowcount == 1

    def course_choices(self, owner_id: int, source_key: str) -> dict[str, bool]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT course, enabled FROM course_choices WHERE owner_id = %s AND source_key = %s",
                (owner_id, source_key),
            )
            return {row["course"]: bool(row["enabled"]) for row in rows}

    def set_course_choice(self, owner_id: int, source_key: str, course: str, enabled: bool) -> None:
        with closing(self._connect()) as connection:
            connection.execute(
                """
                INSERT INTO course_choices(owner_id, source_key, course, enabled)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT(owner_id, source_key, course) DO UPDATE SET enabled = EXCLUDED.enabled
                """,
                (owner_id, source_key, course, enabled),
            )
            connection.commit()

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
        self.add_many(owner_id, [*added, *changed])
        for event in removed:
            if event.id is not None:
                self.delete(owner_id, event.id)
        return added, changed, removed
