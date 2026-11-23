from __future__ import annotations

from fastapi import APIRouter, HTTPException
from openai import OpenAIError
from pydantic import BaseModel, Field

from app.services import orientation_service as service

router = APIRouter(prefix="/orientation", tags=["orientation"])


class StartRequest(BaseModel):
    departements: list[str] = Field(min_length=1)
    nb_questions: int = Field(default=15, ge=10, le=50)
    preferences: str = Field(default="", max_length=2000)


class AnswerRequest(BaseModel):
    numeros: list[int] = Field(min_length=1)


@router.get("/departements")
def list_departements() -> list[str]:
    return service.tous_les_departements


@router.post("/sessions")
def start_session(payload: StartRequest) -> dict:
    try:
        return service.demarrer_session(
            payload.departements, payload.nb_questions, payload.preferences
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OpenAIError, RuntimeError) as error:
        raise HTTPException(status_code=502, detail="Orientation failed") from error


@router.post("/sessions/{session_id}/answer")
def answer_question(session_id: str, payload: AnswerRequest) -> dict:
    try:
        return service.repondre(session_id, payload.numeros)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Session not found") from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OpenAIError, RuntimeError) as error:
        raise HTTPException(status_code=502, detail="Orientation failed") from error