"""
Token budget management for multi-turn conversation history.
Prevents context window overflow by truncating oldest messages first.
Uses character-based estimation (1 token ≈ 4 chars for English, ≈ 2 chars for Hindi).
"""

_CHARS_PER_TOKEN_EN = 4
_CHARS_PER_TOKEN_HI = 2
_MAX_HISTORY_TOKENS = 2000


def estimate_tokens(text: str, medium: str = "en") -> int:
    ratio = _CHARS_PER_TOKEN_HI if medium == "hi" else _CHARS_PER_TOKEN_EN
    return max(1, len(text) // ratio)


def trim_history(
    history: list[dict],
    medium: str = "en",
    max_tokens: int = _MAX_HISTORY_TOKENS,
) -> list[dict]:
    if not history:
        return history

    total = sum(estimate_tokens(m.get("content", ""), medium) for m in history)
    if total <= max_tokens:
        return history

    trimmed = list(history)
    while trimmed and total > max_tokens:
        removed = trimmed.pop(0)
        total -= estimate_tokens(removed.get("content", ""), medium)

    if len(trimmed) % 2 == 1 and trimmed and trimmed[0].get("role") == "assistant":
        removed = trimmed.pop(0)

    return trimmed
