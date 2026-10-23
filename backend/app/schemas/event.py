from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    start_at: dt.datetime
    end_at: dt.datetime
    course: str = Field(default="Personal", max_length=200)
    subject: str = Field(default="unknown", max_length=200)
    location: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def validate_period(self) -> "EventCreate":
        if self.end_at <= self.start_at:
            raise ValueError("The end must be after the start.")
        return self


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    start_at: dt.datetime | None = None
    end_at: dt.datetime | None = None
    course: str | None = Field(default=None, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    uid: str
    source_key: str
    course: str
    subject: str
    title: str
    start_at: dt.datetime
    end_at: dt.datetime
    location: str
    description: str


class ImportResult(BaseModel):
    imported: int
    courses: list[str]


class SyncResult(BaseModel):
    source: str
    added: int
    changed: int
    removed: int
    unknown_courses: list[str] = []
