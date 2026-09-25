from typing import Literal
from pydantic import BaseModel, Field


class QuizGenerateRequest(BaseModel):
    class_num: int = Field(ge=1, le=10)
    subject: str = Field(min_length=1, max_length=50)
    chapter: str | None = Field(default=None, max_length=100)


class MCQOut(BaseModel):
    question_no: int
    question: str = Field(max_length=2000)
    options: dict[str, str]  # {"A": ..., "B": ..., "C": ..., "D": ...}
    answer: Literal["A", "B", "C", "D"]
    explanation: str = Field(max_length=3000)


class ShortAnswerOut(BaseModel):
    question_no: int
    question: str = Field(max_length=2000)
    answer: str = Field(max_length=3000)


class QuizGenerateResponse(BaseModel):
    mcqs: list[MCQOut]
    short_answers: list[ShortAnswerOut]
    plain_text: str = Field(max_length=20000)


class QuizPublishRequest(BaseModel):
    class_num: int = Field(ge=1, le=10)
    subject: str = Field(min_length=1, max_length=50)
    chapter: str | None = Field(default=None, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    mcqs: list[MCQOut] = Field(min_length=1, max_length=50)


class PublishedQuizDTO(BaseModel):
    quiz_id: str
    class_num: int
    subject: str
    chapter: str | None
    title: str
    published_at: str
    mcqs: list[MCQOut]
