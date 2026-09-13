"""Shared fixtures for backend integration tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """A single TestClient for the entire test session."""
    with TestClient(app) as c:
        yield c
