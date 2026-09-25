"""
Semantic chunker — splits extracted pages at section boundaries
(headings, definitions, examples, exercises) instead of fixed character windows.
Keeps worked examples, proofs, and tables intact when possible.
"""
import re

MAX_CHUNK_SIZE = 2000
MIN_CHUNK_SIZE = 80
MERGE_THRESHOLD = 300

CHAPTER_PATTERN = re.compile(
    r"(?:Chapter|ch\.?|अध्याय)\s*[\-–:]?\s*(\d+)\s*[\-–.:]\s*(.*)",
    re.IGNORECASE,
)

_SECTION_BOUNDARY = re.compile(
    r"""
    (?:^|\n)                          # start of line
    (?:
        \d+\.\d+(?:\.\d+)?\s          # numbered section: 1.2 or 1.2.3
      | (?:Example|EXAMPLE|उदाहरण)\s*[\d.:]*\s  # Example / उदाहरण
      | (?:Exercise|EXERCISE|अभ्यास)\s*[\d.:]*\s # Exercise / अभ्यास
      | (?:Definition|DEFINITION|परिभाषा)\s*[\d.:]*[:\-–]?\s  # Definition
      | (?:Theorem|THEOREM|प्रमेय)\s*[\d.:]*[:\-–]?\s  # Theorem
      | (?:Property|PROPERTY|गुण)\s*[\d.:]*[:\-–]?\s   # Property
      | (?:Solution|SOLUTION|हल)\s*[:\-–]?\s            # Solution
      | (?:Note|NOTE|टिप्पणी)\s*[:\-–]?\s               # Note
      | (?:Try\s+These|TRY\s+THESE|प्रयास\s+करो)\s*[:\-–]?\s  # Try These
      | (?:Think,?\s*Discuss|THINK,?\s*DISCUSS|सोचो\s*और\s*चर्चा)\s  # Think Discuss
      | (?:Do\s+You\s+Know|DO\s+YOU\s+KNOW|क्या\s+आप\s+जानते)\s   # Do You Know
      | (?:Summary|SUMMARY|सारांश)\s*[:\-–]?\s          # Summary
      | (?:Key\s+Points|मुख्य\s+बिंदु)\s*[:\-–]?\s     # Key Points
      | (?:Formulas?|FORMULAS?|सूत्र)\s*[:\-–]?\s       # Formula
      | (?:Activity|ACTIVITY|क्रियाकलाप)\s*[\d.:]*\s    # Activity
      | (?:Figure|Fig\.?|चित्र)\s*[\d.:]+\s              # Figure reference
      | (?:Table|तालिका)\s*[\d.:]+\s                     # Table reference
      | Q\.\s*\d+                                        # Q. 1, Q. 2 etc.
    )
    """,
    re.VERBOSE | re.IGNORECASE | re.MULTILINE,
)

_HEADING_PATTERN = re.compile(
    r"^[A-Zऀ-ॿ][A-Zऀ-ॿ\s\d.:–\-]{3,60}$",
    re.MULTILINE,
)

_PARAGRAPH_BREAK = re.compile(r"\n\s*\n")


def detect_chapter(text: str) -> str | None:
    match = CHAPTER_PATTERN.search(text[:500])
    if match:
        num = match.group(1)
        name = match.group(2).strip()
        return f"chapter {num} - {name}" if name else f"chapter {num}"
    return None


def chunk_pages(pages: list[dict], default_chapter: str | None = None) -> list[dict]:
    """
    Takes [{page_num, text}, ...] and returns [{text, page_num, chapter}, ...].
    Splits at semantic boundaries, merges small fragments, respects max size.
    """
    raw_segments = _split_pages_into_segments(pages, default_chapter)
    merged = _merge_small_segments(raw_segments)
    final = _enforce_max_size(merged)
    return [s for s in final if len(s["text"].strip()) >= MIN_CHUNK_SIZE]


def _split_pages_into_segments(
    pages: list[dict], default_chapter: str | None
) -> list[dict]:
    """Split pages at section boundaries into raw segments."""
    segments = []
    current_chapter = default_chapter

    for page in pages:
        detected = detect_chapter(page["text"])
        if detected:
            current_chapter = detected

        text = page["text"]
        parts = _split_at_boundaries(text)

        for part in parts:
            if part.strip():
                segments.append({
                    "text": part.strip(),
                    "page_num": page["page_num"],
                    "chapter": current_chapter,
                })

    return segments


def _split_at_boundaries(text: str) -> list[str]:
    """Split text at section boundaries, keeping each section together."""
    boundary_positions = set()

    for m in _SECTION_BOUNDARY.finditer(text):
        boundary_positions.add(m.start())

    for m in _HEADING_PATTERN.finditer(text):
        pos = m.start()
        line = m.group(0).strip()
        if len(line) > 5 and not line.replace(" ", "").isdigit():
            boundary_positions.add(pos)

    for m in _PARAGRAPH_BREAK.finditer(text):
        boundary_positions.add(m.start())

    if not boundary_positions:
        return [text]

    positions = sorted(boundary_positions)
    parts = []
    prev = 0
    for pos in positions:
        if pos > prev:
            parts.append(text[prev:pos])
        prev = pos
    if prev < len(text):
        parts.append(text[prev:])

    return [p for p in parts if p.strip()]


def _merge_small_segments(segments: list[dict]) -> list[dict]:
    """Merge segments smaller than MERGE_THRESHOLD with their neighbors."""
    if not segments:
        return segments

    merged = [segments[0].copy()]

    for seg in segments[1:]:
        prev = merged[-1]
        combined_len = len(prev["text"]) + len(seg["text"]) + 2

        same_chapter = prev["chapter"] == seg["chapter"]
        prev_small = len(prev["text"]) < MERGE_THRESHOLD
        seg_small = len(seg["text"]) < MERGE_THRESHOLD

        if same_chapter and (prev_small or seg_small) and combined_len <= MAX_CHUNK_SIZE:
            prev["text"] = prev["text"] + "\n\n" + seg["text"]
            if seg["page_num"] != prev["page_num"]:
                prev["page_num"] = seg["page_num"]
        else:
            merged.append(seg.copy())

    return merged


def _enforce_max_size(segments: list[dict]) -> list[dict]:
    """Split any segment that exceeds MAX_CHUNK_SIZE at paragraph boundaries."""
    result = []
    overlap = 100

    for seg in segments:
        if len(seg["text"]) <= MAX_CHUNK_SIZE:
            result.append(seg)
            continue

        text = seg["text"]
        para_breaks = [m.start() for m in _PARAGRAPH_BREAK.finditer(text)]

        if para_breaks:
            parts = _split_at_nearest_breaks(text, para_breaks)
        else:
            parts = _split_with_overlap(text, MAX_CHUNK_SIZE, overlap)

        for part in parts:
            if part.strip():
                result.append({
                    "text": part.strip(),
                    "page_num": seg["page_num"],
                    "chapter": seg["chapter"],
                })

    return result


def _split_at_nearest_breaks(text: str, breaks: list[int]) -> list[str]:
    """Split text at paragraph breaks, keeping chunks under MAX_CHUNK_SIZE."""
    parts = []
    start = 0

    for brk in breaks:
        if brk - start >= MAX_CHUNK_SIZE:
            parts.append(text[start:brk])
            start = brk
    if start < len(text):
        parts.append(text[start:])

    return parts


def _split_with_overlap(text: str, size: int, overlap: int) -> list[str]:
    """Fallback: fixed-window split with overlap for text without paragraph breaks."""
    parts = []
    start = 0
    while start < len(text):
        end = start + size
        parts.append(text[start:end])
        start += size - overlap
    return parts
