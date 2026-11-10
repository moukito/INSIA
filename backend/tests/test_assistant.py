from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import pytest
from app.ai import ToolContext, create_calendar_tool_registry
from app.ai.assistant import AssistantService
from app.api.routes.assistant import get_assistant
from app.api.routes.calendar import get_repository
from app.config import Settings
from app.main import app
from app.services import CalendarService

from .test_calendar import InMemoryEventRepository


@dataclass
class FunctionCall:
    type: str
    name: str
    arguments: str
    call_id: str


@dataclass
class Response:
    output: list[object]
    output_text: str


class FakeResponses:
    def __init__(self) -> None:
        self.calls = 0

    async def create(self, **_: object) -> Response:
        self.calls += 1
        if self.calls == 1:
            return Response(
                output=[
                    FunctionCall(
                        type="function_call",
                        name="calendar_create_event",
                        arguments=(
                            '{"title":"English lesson practice",'
                            '"start_at":"2026-11-11T08:00:00+01:00",'
                            '"end_at":"2026-11-11T09:00:00+01:00",'
                            '"description":"Practise English lesson"}'
                        ),
                        call_id="call-1",
                    )
                ],
                output_text="",
            )
        return Response(
            output=[],
            output_text="The English practice event was created for tomorrow at 8:00.",
        )


@dataclass
class FakeClient:
    responses: FakeResponses


def assistant_settings() -> Settings:
    return Settings.from_environment()


@pytest.mark.asyncio
async def test_assistant_uses_calendar_tool_to_create_event() -> None:
    repository = InMemoryEventRepository()
    service = CalendarService(repository)
    client = FakeClient(FakeResponses())
    assistant = AssistantService(
        client,
        create_calendar_tool_registry(service),
        assistant_settings(),
        clock=lambda timezone: dt.datetime(2026, 11, 10, 9, tzinfo=timezone),
    )

    result = await assistant.chat(
        [
            {
                "role": "user",
                "content": "Create an event tomorrow at 8 am to practise English.",
            }
        ],
        ToolContext(owner_id=42),
    )

    assert result.tool_calls == ("calendar_create_event",)
    assert "created" in result.text
    assert len(repository.events) == 1
    event = next(iter(repository.events.values()))
    assert event.owner_id == 42
    assert event.start_at == dt.datetime(
        2026, 11, 11, 8, tzinfo=dt.timezone(dt.timedelta(hours=1))
    )

    print(f"Event: {event}")


def test_chat_request_accepts_message_or_history() -> None:
    from app.schemas import ChatRequest

    assert ChatRequest(message="Hello").messages() == [
        {"role": "user", "content": "Hello"}
    ]
    assert (
        ChatRequest(
            history=[
                {"role": "user", "content": "Create an event"},
                {"role": "assistant", "content": "What time?"},
            ]
        ).messages()[1]["role"]
        == "assistant"
    )


@pytest.mark.asyncio
async def test_chat_endpoint_returns_final_answer_and_tool_trace() -> None:
    repository = InMemoryEventRepository()
    service = CalendarService(repository)
    assistant = AssistantService(
        FakeClient(FakeResponses()),
        create_calendar_tool_registry(service),
        assistant_settings(),
        clock=lambda timezone: dt.datetime(2026, 11, 10, 9, tzinfo=timezone),
    )
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_assistant] = lambda: assistant

    try:
        from fastapi.testclient import TestClient

        response = TestClient(app).post(
            "/api/ai/chat",
            headers={"X-Owner-ID": "21"},
            json={"message": "Create an event tomorrow at 8 am to practise English."},
        )
        assert response.status_code == 200
        assert response.json()["tool_calls"] == ["calendar_create_event"]
        assert next(iter(repository.events.values())).owner_id == 21

        print(f"Response JSON: {response.json()}")
    finally:
        app.dependency_overrides.clear()
