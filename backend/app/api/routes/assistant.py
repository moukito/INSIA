from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.ai import ToolContext, create_calendar_tool_registry
from app.ai.assistant import (
    AssistantError,
    AssistantService,
    create_openai_client,
)
from app.api.routes.calendar import get_service, owner_id
from app.config import Settings
from app.schemas.assistant import ChatRequest, ChatResponse
from app.services import CalendarService

router = APIRouter(prefix="/ai", tags=["ai"])


def get_settings() -> Settings:
    return Settings.from_environment()


def get_assistant(
    settings: Annotated[Settings, Depends(get_settings)],
    service: Annotated[CalendarService, Depends(get_service)],
) -> AssistantService:
    try:
        client = create_openai_client(settings.openai_api_key)
    except AssistantError as error:
        raise _assistant_error(error) from error
    return AssistantService(client, create_calendar_tool_registry(service), settings)


def _assistant_error(error: AssistantError) -> HTTPException:
    status_code = (
        503 if error.code in {"configuration_error", "provider_error"} else 422
    )
    return HTTPException(
        status_code=status_code,
        detail={"code": error.code, "message": str(error)},
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    owner: Annotated[int, Depends(owner_id)],
    assistant: Annotated[AssistantService, Depends(get_assistant)],
) -> ChatResponse:
    try:
        result = await assistant.chat(payload.messages(), ToolContext(owner_id=owner))
    except AssistantError as error:
        raise _assistant_error(error) from error
    return ChatResponse(text=result.text, tool_calls=list(result.tool_calls))


@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    owner: Annotated[int, Depends(owner_id)],
    assistant: Annotated[AssistantService, Depends(get_assistant)],
) -> StreamingResponse:
    async def events():
        try:
            async for event in assistant.stream_chat(
                payload.messages(), ToolContext(owner_id=owner)
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except AssistantError as error:
            yield f"event: error\ndata: {json.dumps({'code': error.code, 'message': str(error)})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
