from __future__ import annotations

import datetime as dt

from app.api.routes.calendar import get_repository
from app.main import app
from fastapi.testclient import TestClient

from .test_calendar import InMemoryEventRepository


def test_calendar_tools_are_discoverable_and_owner_scoped() -> None:
    repository = InMemoryEventRepository()
    app.dependency_overrides[get_repository] = lambda: repository
    client = TestClient(app)

    try:
        response = client.get("/api/tools", headers={"X-Owner-ID": "7"})
        assert response.status_code == 200
        names = {tool["name"] for tool in response.json()}
        assert names == {
            "calendar_list_events",
            "calendar_get_event",
            "calendar_create_event",
            "calendar_update_event",
            "calendar_delete_event",
            "calendar_import_ics",
            "calendar_sync",
        }
        assert all(
            "owner_id" not in tool["parameters"].get("properties", {})
            for tool in response.json()
        )
    finally:
        app.dependency_overrides.clear()


def test_calendar_tools_execute_with_server_owner_context() -> None:
    repository = InMemoryEventRepository()
    app.dependency_overrides[get_repository] = lambda: repository
    client = TestClient(app)

    try:
        response = client.post(
            "/api/tools/calendar_create_event",
            headers={"X-Owner-ID": "7"},
            json={
                "arguments": {
                    "title": "Cours",
                    "start_at": "2026-10-23T10:00:00Z",
                    "end_at": "2026-10-23T11:00:00Z",
                }
            },
        )
        assert response.status_code == 200
        event = response.json()
        assert event["owner_id"] == 7

        assert (
            client.post(
                "/api/tools/calendar_get_event",
                headers={"X-Owner-ID": "8"},
                json={"arguments": {"event_id": event["id"]}},
            ).status_code
            == 404
        )
        listed = client.post(
            "/api/tools/calendar_list_events",
            headers={"X-Owner-ID": "7"},
            json={
                "arguments": {
                    "start": "2026-10-23T00:00:00Z",
                    "end": "2026-10-24T00:00:00Z",
                }
            },
        )
        assert listed.status_code == 200
        assert listed.json()[0]["title"] == "Cours"
    finally:
        app.dependency_overrides.clear()


def test_calendar_tool_rejects_invalid_arguments() -> None:
    repository = InMemoryEventRepository()
    app.dependency_overrides[get_repository] = lambda: repository
    client = TestClient(app)

    try:
        response = client.post(
            "/api/tools/calendar_create_event",
            headers={"X-Owner-ID": "7"},
            json={
                "arguments": {
                    "title": "Invalid",
                    "start_at": dt.datetime(2026, 10, 23, 11).isoformat(),
                    "end_at": dt.datetime(2026, 10, 23, 10).isoformat(),
                }
            },
        )
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "invalid_arguments"
    finally:
        app.dependency_overrides.clear()
