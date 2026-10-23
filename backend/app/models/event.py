from __future__ import annotations

import datetime as dt
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Event:
    id: int | None
    owner_id: int
    uid: str
    source_key: str
    course: str
    subject: str
    title: str
    start_at: dt.datetime
    end_at: dt.datetime
    location: str = ""
    description: str = ""
    reminder_sent_at: dt.datetime | None = None

    @property
    def starts_in(self) -> dt.timedelta:
        return self.start_at - dt.datetime.now(dt.UTC)
