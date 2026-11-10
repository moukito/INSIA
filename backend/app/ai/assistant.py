from __future__ import annotations

import datetime as dt
import json
from collections.abc import AsyncIterator, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from app.config import Settings

from .tools import ToolContext, ToolError, ToolRegistry


class ResponsesClient(Protocol):
    class responses(Protocol):
        @staticmethod
        async def create(**kwargs: Any) -> Any: ...


@dataclass(frozen=True, slots=True)
class ChatResult:
    text: str
    tool_calls: tuple[str, ...]


class AssistantError(Exception):
    def __init__(self, message: str, *, code: str = "assistant_error") -> None:
        super().__init__(message)
        self.code = code


class AssistantService:
    def __init__(
        self,
        client: ResponsesClient,
        registry: ToolRegistry,
        settings: Settings,
        *,
        clock: Callable[..., dt.datetime] = dt.datetime.now,
    ) -> None:
        self.client = client
        self.registry = registry
        self.settings = settings
        self.clock = clock

    def _instructions(self) -> str:
        now = self.clock(self.settings.timezone)
        return (
            "You are the INSIA student assistant. Use calendar tools whenever the "
            "user asks to read or change calendar data. Never claim an event was "
            "created until the tool succeeds. Resolve relative dates and times "
            f"using the {self.settings.timezone} local time context: {now.isoformat()}. "
            "When creating an event, use an ISO-8601 datetime with timezone. "
            "If the user gives a start but no duration, use a one-hour event. "
            "Keep the title and description faithful to the request."
        )

    async def chat(
        self,
        messages: Sequence[Mapping[str, str]],
        context: ToolContext,
    ) -> ChatResult:
        request_input: list[Any] = [dict(message) for message in messages]
        tool_calls: list[str] = []

        for _ in range(self.settings.assistant_max_rounds):
            try:
                response = await self.client.responses.create(
                    model=self.settings.openai_model,
                    input=request_input,
                    instructions=self._instructions(),
                    tools=self.registry.definitions(),
                )
            except Exception as error:
                raise AssistantError(
                    "The AI provider request failed.",
                    code="provider_error",
                ) from error

            output_items = list(getattr(response, "output", []))
            request_input.extend(output_items)
            function_outputs: list[dict[str, str]] = []
            for item in output_items:
                if getattr(item, "type", None) != "function_call":
                    continue
                name = str(item.name)
                tool_calls.append(name)
                try:
                    arguments = json.loads(item.arguments)
                    result = await self.registry.execute(name, arguments, context)
                except (json.JSONDecodeError, TypeError, ToolError) as error:
                    if isinstance(error, ToolError):
                        message = str(error)
                    else:
                        message = "The model returned invalid tool arguments."
                    function_outputs.append(
                        {
                            "type": "function_call_output",
                            "call_id": item.call_id,
                            "output": json.dumps({"error": message}),
                        }
                    )
                else:
                    function_outputs.append(
                        {
                            "type": "function_call_output",
                            "call_id": item.call_id,
                            "output": json.dumps(result),
                        }
                    )

            request_input.extend(function_outputs)
            if not function_outputs:
                text = str(getattr(response, "output_text", "")).strip()
                if not text:
                    raise AssistantError(
                        "The AI returned no final answer.",
                        code="empty_response",
                    )
                return ChatResult(text=text, tool_calls=tuple(tool_calls))

        raise AssistantError(
            "The AI exceeded the maximum number of tool-call rounds.",
            code="max_rounds_exceeded",
        )

    async def stream_chat(
        self,
        messages: Sequence[Mapping[str, str]],
        context: ToolContext,
    ) -> AsyncIterator[dict[str, Any]]:
        result = await self.chat(messages, context)
        for tool_name in result.tool_calls:
            yield {"type": "tool_call", "name": tool_name}
        yield {"type": "final", "text": result.text}


def create_openai_client(api_key: str) -> ResponsesClient:
    if not api_key:
        raise AssistantError(
            "OPENAI_API_KEY is not configured.",
            code="configuration_error",
        )
    from openai import AsyncOpenAI

    return AsyncOpenAI(api_key=api_key)
