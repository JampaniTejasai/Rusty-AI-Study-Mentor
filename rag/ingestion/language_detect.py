"""
Detect whether text is primarily Hindi (Devanagari) or English.
Uses Unicode range detection — no external dependencies.
"""
import re

_DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")


def detect_language(text: str) -> str:
    if not text:
        return "en"
    sample = text[:2000]
    devanagari_count = len(_DEVANAGARI_RE.findall(sample))
    latin_count = sum(1 for c in sample if c.isascii() and c.isalpha())
    total = devanagari_count + latin_count
    if total == 0:
        return "en"
    return "hi" if devanagari_count / total > 0.3 else "en"
