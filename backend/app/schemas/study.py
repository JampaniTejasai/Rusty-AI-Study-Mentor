from typing import Literal
from pydantic import BaseModel, Field

VALID_SUBJECTS = {"mathematics", "science", "hindi", "social_science", "english"}


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=500)


class StudyQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    subject: str = Field(min_length=1, max_length=50)
    chapter: str | None = Field(default=None, max_length=100)
    medium: Literal["en", "hi"] = "en"
    history: list[HistoryMessage] = Field(default_factory=list, max_length=10)

    @property
    def subject_clean(self) -> str:
        return self.subject.lower().strip()


class SourceRef(BaseModel):
    chapter: str | None = None
    page_num: int | None = None
    source_pdf: str | None = None


class StudyResponseDTO(BaseModel):
    key_points: list[str]
    notes: str
    misconceptions: list[str]
    source_chunks: int
    has_math: bool
    sources: list[SourceRef] = Field(default_factory=list)
