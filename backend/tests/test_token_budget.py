"""Tests for token budget trimming."""
from app.services.token_budget import estimate_tokens, trim_history


def test_estimate_tokens_english():
    assert estimate_tokens("hello world", "en") == 2  # 11 chars / 4


def test_estimate_tokens_hindi():
    text = "नमस्ते दुनिया"
    result = estimate_tokens(text, "hi")
    assert result >= 5  # Hindi chars are 3 bytes each


def test_empty_history():
    assert trim_history([], "en") == []


def test_short_history_unchanged():
    history = [
        {"role": "user", "content": "What is a square?"},
        {"role": "assistant", "content": "A square is a number multiplied by itself."},
    ]
    result = trim_history(history, "en", max_tokens=500)
    assert len(result) == 2


def test_long_history_trimmed():
    history = [
        {"role": "user", "content": "a" * 400},
        {"role": "assistant", "content": "b" * 400},
        {"role": "user", "content": "c" * 400},
        {"role": "assistant", "content": "d" * 400},
        {"role": "user", "content": "latest question"},
    ]
    result = trim_history(history, "en", max_tokens=200)
    assert len(result) < len(history)
    assert result[-1]["content"] == "latest question"


def test_keeps_pairs():
    history = [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a" * 4000},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
    ]
    result = trim_history(history, "en", max_tokens=50)
    if result and result[0]["role"] == "assistant":
        assert False, "Should not start with assistant message"
