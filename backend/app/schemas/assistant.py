from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"] = "user"
    content: str = Field(min_length=1, max_length=10000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str | None = Field(default=None, min_length=1, max_length=10000)
    history: list[ChatMessage] | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def require_one_input(self) -> ChatRequest:
        if (self.message is None) == (self.history is None):
            raise ValueError("Provide either message or history.")
        return self

    def messages(self) -> list[dict[str, str]]:
        if self.message is not None:
            return [{"role": "user", "content": self.message}]
        return [message.model_dump() for message in self.history or []]


class ChatResponse(BaseModel):
    text: str
    tool_calls: list[str]
