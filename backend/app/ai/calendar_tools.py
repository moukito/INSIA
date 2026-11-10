from __future__ import annotations

import datetime as dt

import httpx
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from app.schemas import EventCreate, EventRead, EventUpdate, ImportResult, SyncResult
from app.services import CalendarService

from .tools import ToolContext, ToolError, ToolRegistry


class ListEventsArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: dt.datetime | None = None
    end: dt.datetime | None = None

    @model_validator(mode="after")
    def validate_period(self) -> ListEventsArguments:
        if self.start and self.end and self.end <= self.start:
            raise ValueError("end must be after start")
        return self


class GetEventArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: int = Field(ge=1)


class CreateEventArguments(EventCreate):
    model_config = ConfigDict(extra="forbid")


class UpdateEventArguments(EventUpdate):
    model_config = ConfigDict(extra="forbid")

    event_id: int = Field(ge=1)


class DeleteEventArguments(GetEventArguments):
    pass


class ImportEventsArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_key: str = Field(min_length=1, max_length=200)
    ics_content: str = Field(min_length=1)


class SynchronizeEventsArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_key: str = Field(min_length=1, max_length=200)
    url: HttpUrl


def _event_read(event: object) -> dict[str, object]:
    return EventRead.model_validate(event).model_dump(mode="json")


def create_calendar_tool_registry(service: CalendarService) -> ToolRegistry:
    registry = ToolRegistry()

    def list_events(
        context: ToolContext, arguments: ListEventsArguments
    ) -> list[dict[str, object]]:
        events = service.list_events(context.owner_id, arguments.start, arguments.end)
        return [_event_read(event) for event in events]

    def get_event(
        context: ToolContext, arguments: GetEventArguments
    ) -> dict[str, object]:
        event = service.get_event(context.owner_id, arguments.event_id)
        if event is None:
            raise ToolError("Event not found.", code="not_found")
        return _event_read(event)

    def create_event(
        context: ToolContext, arguments: CreateEventArguments
    ) -> dict[str, object]:
        event = service.create_event(context.owner_id, arguments.model_dump())
        return _event_read(event)

    def update_event(
        context: ToolContext, arguments: UpdateEventArguments
    ) -> dict[str, object]:
        values = arguments.model_dump(exclude_unset=True, exclude={"event_id"})
        try:
            event = service.update_event(context.owner_id, arguments.event_id, values)
        except ValueError as error:
            raise ToolError(str(error), code="invalid_arguments") from error
        if event is None:
            raise ToolError("Event not found.", code="not_found")
        return _event_read(event)

    def delete_event(
        context: ToolContext, arguments: DeleteEventArguments
    ) -> dict[str, bool]:
        if not service.delete_event(context.owner_id, arguments.event_id):
            raise ToolError("Event not found.", code="not_found")
        return {"deleted": True}

    def import_events(
        context: ToolContext, arguments: ImportEventsArguments
    ) -> dict[str, object]:
        try:
            imported, courses = service.import_ics(
                context.owner_id,
                arguments.source_key,
                arguments.ics_content.encode("utf-8"),
            )
        except ValueError as error:
            raise ToolError(str(error), code="invalid_arguments") from error
        return ImportResult(imported=imported, courses=courses).model_dump(mode="json")

    async def synchronize_events(
        context: ToolContext,
        arguments: SynchronizeEventsArguments,
    ) -> dict[str, object]:
        try:
            changes = await service.synchronize(
                context.owner_id,
                arguments.source_key,
                str(arguments.url),
            )
        except (httpx.HTTPError, ValueError) as error:
            raise ToolError(str(error), code="synchronization_failed") from error
        if changes is None:
            raise ToolError(
                "Calendar synchronization failed.", code="synchronization_failed"
            )
        return SyncResult(
            source=changes.source,
            added=len(changes.added),
            changed=len(changes.changed),
            removed=len(changes.removed),
            unknown_courses=changes.unknown_courses,
        ).model_dump(mode="json")

    registry.register(
        "calendar_list_events",
        "List calendar events for the current owner, optionally within a time range.",
        ListEventsArguments,
        list_events,
    )
    registry.register(
        "calendar_get_event",
        "Get one calendar event belonging to the current owner.",
        GetEventArguments,
        get_event,
    )
    registry.register(
        "calendar_create_event",
        "Create a personal calendar event for the current owner.",
        CreateEventArguments,
        create_event,
    )
    registry.register(
        "calendar_update_event",
        "Update a calendar event belonging to the current owner.",
        UpdateEventArguments,
        update_event,
    )
    registry.register(
        "calendar_delete_event",
        "Delete a calendar event belonging to the current owner.",
        DeleteEventArguments,
        delete_event,
    )
    registry.register(
        "calendar_import_ics",
        "Import iCalendar content into the current owner's calendar.",
        ImportEventsArguments,
        import_events,
    )
    registry.register(
        "calendar_sync",
        "Synchronize a remote iCalendar source for the current owner.",
        SynchronizeEventsArguments,
        synchronize_events,
    )
    return registry
