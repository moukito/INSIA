from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from app.ai import ToolContext, ToolError, ToolRegistry, create_calendar_tool_registry
from app.api.routes.calendar import get_service, owner_id
from app.services import CalendarService

router = APIRouter(prefix="/tools", tags=["tools"])


class ToolExecutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    arguments: dict[str, Any] = {}


def get_registry(
    service: Annotated[CalendarService, Depends(get_service)],
) -> ToolRegistry:
    return create_calendar_tool_registry(service)


@router.get("")
def list_tools(
    _: Annotated[int, Depends(owner_id)],
    registry: Annotated[ToolRegistry, Depends(get_registry)],
) -> list[dict[str, Any]]:
    return registry.definitions()


@router.post("/{tool_name}")
async def execute_tool(
    tool_name: str,
    payload: ToolExecutionRequest,
    owner: Annotated[int, Depends(owner_id)],
    registry: Annotated[ToolRegistry, Depends(get_registry)],
) -> Any:
    try:
        return await registry.execute(
            tool_name,
            payload.arguments,
            ToolContext(owner_id=owner),
        )
    except ToolError as error:
        status_code = 404 if error.code == "not_found" else 422
        raise HTTPException(
            status_code=status_code,
            detail={
                "code": error.code,
                "message": str(error),
            },
        ) from error
