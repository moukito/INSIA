from __future__ import annotations

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, HttpUrl

from app.config import Settings
from app.repositories import EventRepository
from app.schemas import EventCreate, EventRead, EventUpdate, ImportResult, SyncResult
from app.services import CalendarService

router = APIRouter(prefix="/calendar", tags=["calendar"])


class SyncRequest(BaseModel):
    url: HttpUrl


def get_settings() -> Settings:
    return Settings.from_environment()


def get_repository(settings: Annotated[Settings, Depends(get_settings)]) -> EventRepository:
    from app.repositories.event_repository import PostgresEventRepository

    return PostgresEventRepository(settings.database_url)


def get_service(repository: Annotated[EventRepository, Depends(get_repository)]) -> CalendarService:
    return CalendarService(repository)


def owner_id(x_owner_id: Annotated[int, Header(alias="X-Owner-ID", ge=1)]) -> int:
    return x_owner_id


@router.get("/events", response_model=list[EventRead])
def list_events(
    owner: Annotated[int, Depends(owner_id)],
    service: Annotated[CalendarService, Depends(get_service)],
    start: dt.datetime | None = Query(default=None),
    end: dt.datetime | None = Query(default=None),
) -> list[EventRead]:
    if start and end and end <= start:
        raise HTTPException(status_code=400, detail="end must be after start")
    return [EventRead.model_validate(event) for event in service.list_events(owner, start, end)]


@router.post("/events", response_model=EventRead, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    owner: Annotated[int, Depends(owner_id)],
    service: Annotated[CalendarService, Depends(get_service)],
) -> EventRead:
    return EventRead.model_validate(service.create_event(owner, payload.model_dump()))


@router.get("/events/{event_id}", response_model=EventRead)
def get_event(
    event_id: int,
    owner: Annotated[int, Depends(owner_id)],
    service: Annotated[CalendarService, Depends(get_service)],
) -> EventRead:
    event = service.get_event(owner, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventRead.model_validate(event)


@router.patch("/events/{event_id}", response_model=EventRead)
def update_event(
    event_id: int,
    payload: EventUpdate,
    owner: Annotated[int, Depends(owner_id)],
    service: Annotated[CalendarService, Depends(get_service)],
) -> EventRead:
    try:
        event = service.update_event(owner, event_id, payload.model_dump(exclude_unset=True))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventRead.model_validate(event)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    owner: Annotated[int, Depends(owner_id)],
    service: Annotated[CalendarService, Depends(get_service)],
) -> None:
    if not service.delete_event(owner, event_id):
        raise HTTPException(status_code=404, detail="Event not found")


@router.post("/sources/{source_key}/import", response_model=ImportResult)
async def import_events(
    source_key: str,
    owner: Annotated[int, Depends(owner_id)],
    service: Annotated[CalendarService, Depends(get_service)],
    file: UploadFile = File(...),
) -> ImportResult:
    try:
        count, courses = service.import_ics(owner, source_key, await file.read())
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return ImportResult(imported=count, courses=courses)


@router.post("/sources/{source_key}/sync", response_model=SyncResult)
async def synchronize_events(
    source_key: str,
    payload: SyncRequest,
    owner: Annotated[int, Depends(owner_id)],
    service: Annotated[CalendarService, Depends(get_service)],
) -> SyncResult:
    changes = await service.synchronize(owner, source_key, str(payload.url))
    if changes is None:
        raise HTTPException(status_code=502, detail="Calendar synchronization failed")
    return SyncResult(
        source=changes.source,
        added=len(changes.added),
        changed=len(changes.changed),
        removed=len(changes.removed),
        unknown_courses=changes.unknown_courses,
    )
