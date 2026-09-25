"""
Builds the SQL pre-filter dict used by ChunkRepository.
This is the architectural textbook boundary — Gemini physically
cannot see chunks outside the student's class/subject.
"""

VALID_SUBJECTS = {"mathematics", "science", "hindi", "social_science", "english"}
VALID_CLASSES = set(range(1, 11))


def build_filter(class_num: int, subject: str, chapter: str | None) -> dict:
    if class_num not in VALID_CLASSES:
        raise ValueError(f"Invalid class_num: {class_num}")
    subject_clean = subject.lower().strip()
    if subject_clean not in VALID_SUBJECTS:
        raise ValueError(f"Invalid subject: {subject}")

    return {
        "class_num": class_num,
        "subject": subject_clean,
        "chapter": chapter.strip() if chapter else None,
    }
