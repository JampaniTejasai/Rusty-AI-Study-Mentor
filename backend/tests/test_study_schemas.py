import pytest
from pydantic import ValidationError
from app.schemas.study import StudyQueryRequest


def test_query_valid():
    r = StudyQueryRequest(query="What is photosynthesis?", subject="science")
    assert r.query == "What is photosynthesis?"


def test_query_too_long():
    with pytest.raises(ValidationError):
        StudyQueryRequest(query="x" * 501, subject="science")


def test_query_empty():
    with pytest.raises(ValidationError):
        StudyQueryRequest(query="", subject="science")


def test_history_max_10_turns():
    history = [{"role": "user", "content": "hi"} for _ in range(11)]
    with pytest.raises(ValidationError):
        StudyQueryRequest(query="test", subject="science", history=history)


def test_history_content_max_500():
    history = [{"role": "user", "content": "x" * 501}]
    with pytest.raises(ValidationError):
        StudyQueryRequest(query="test", subject="science", history=history)
