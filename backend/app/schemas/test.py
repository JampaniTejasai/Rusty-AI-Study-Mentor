from typing import Literal
from pydantic import BaseModel, Field
import uuid


class TestGenerateRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=50)
    chapter: str | None = Field(default=None, max_length=100)
    medium: Literal["en", "hi"] = "en"


class QuestionOption(BaseModel):
    A: str
    B: str
    C: str
    D: str


class QuestionOut(BaseModel):
    question_id: uuid.UUID
    question_no: int
    question_text: str
    options: QuestionOption
    has_math: bool


class TestGenerateResponse(BaseModel):
    test_id: uuid.UUID
    questions: list[QuestionOut]


class TestAnswerRequest(BaseModel):
    test_id: uuid.UUID
    question_id: uuid.UUID
    answer: Literal["A", "B", "C", "D"]


class TestAnswerResponse(BaseModel):
    is_correct: bool
    correct_option: str
    explanation: str
    score_so_far: int
    questions_remaining: int


class TestResultResponse(BaseModel):
    score: int
    total: int
    weak_topics: list[str]
    math_type_breakdown: dict[str, int]


class MyTestEntry(BaseModel):
    test_id: uuid.UUID
    title: str
    subject: str
    chapter: str | None
    created_at: str
    status: Literal["in_progress", "completed"]
    score: int | None
    total: int
    questions_answered: int
    is_ai_generated: bool


class MyTestsResponse(BaseModel):
    tests: list[MyTestEntry]


class ResumeQuestionOut(BaseModel):
    question_id: uuid.UUID
    question_no: int
    question_text: str
    options: QuestionOption
    has_math: bool
    student_answer: str | None = None
    is_correct: bool | None = None
    correct_option: str | None = None
    explanation: str | None = None


class TestResumeResponse(BaseModel):
    test_id: uuid.UUID
    title: str
    subject: str
    chapter: str | None
    questions: list[ResumeQuestionOut]
    current_index: int
    score_so_far: int
