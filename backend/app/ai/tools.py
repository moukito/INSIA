from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError


def _make_strict_json_schema(schema: dict[str, Any]) -> dict[str, Any]:
    result = dict(schema)
    if result.get("format") == "uri":
        result.pop("format")
    properties = result.get("properties")
    if isinstance(properties, dict):
        result["required"] = list(properties)
        result["additionalProperties"] = False
        result["properties"] = {
            name: _make_strict_json_schema(value)
            if isinstance(value, dict)
            else value
            for name, value in properties.items()
        }
    for key in ("allOf", "anyOf", "oneOf"):
        variants = result.get(key)
        if isinstance(variants, list):
            result[key] = [
                _make_strict_json_schema(value)
                if isinstance(value, dict)
                else value
                for value in variants
            ]
    items = result.get("items")
    if isinstance(items, dict):
        result["items"] = _make_strict_json_schema(items)
    return result


@dataclass(frozen=True, slots=True)
class ToolContext:
    """Server-owned values available to a tool handler."""

    owner_id: int


class ToolError(Exception):
    def __init__(self, message: str, *, code: str = "tool_error") -> None:
        super().__init__(message)
        self.code = code


ToolHandler = Callable[[ToolContext, BaseModel], Any | Awaitable[Any]]


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    name: str
    description: str
    input_model: type[BaseModel]
    handler: ToolHandler

    def as_function_tool(self) -> dict[str, Any]:
        return {
            "type": "function",
            "name": self.name,
            "description": self.description,
            "parameters": _make_strict_json_schema(
                self.input_model.model_json_schema()
            ),
            "strict": True,
        }


class ToolRegistry:
    """Provider-neutral registry for tools exposed by backend modules."""

    def __init__(self) -> None:
        self._definitions: dict[str, ToolDefinition] = {}

    def register(
        self,
        name: str,
        description: str,
        input_model: type[BaseModel],
        handler: ToolHandler,
    ) -> ToolDefinition:
        if name in self._definitions:
            raise ValueError(f"Tool already registered: {name}")
        definition = ToolDefinition(name, description, input_model, handler)
        self._definitions[name] = definition
        return definition

    def definitions(self) -> list[dict[str, Any]]:
        return [
            definition.as_function_tool() for definition in self._definitions.values()
        ]

    async def execute(
        self,
        name: str,
        arguments: Mapping[str, Any],
        context: ToolContext,
    ) -> Any:
        definition = self._definitions.get(name)
        if definition is None:
            raise ToolError(f"Unsupported tool: {name}", code="unknown_tool")
        try:
            payload = definition.input_model.model_validate(dict(arguments))
        except ValidationError as error:
            raise ToolError(
                "Invalid tool arguments.",
                code="invalid_arguments",
            ) from error
        result = definition.handler(context, payload)
        return await result if inspect.isawaitable(result) else result
