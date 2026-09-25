import re
from pydantic import BaseModel, Field, field_validator

STUDENT_ID_RE = re.compile(r"^KHEL-\d{4}-(?:\d{3,4}|T\d{2,3}|ADM\d{1,2})$")
VALID_SUBJECTS = {"mathematics", "science", "hindi", "social_science", "english"}
VALID_CLASSES = set(range(1, 11))


def _validate_student_id(v: str) -> str:
    if not STUDENT_ID_RE.match(v):
        raise ValueError("Invalid student ID format")
    return v


class LoginRequest(BaseModel):
    student_id: str = Field(min_length=10, max_length=20)
    pin: str = Field(min_length=4, max_length=6, pattern=r"^\d{4,6}$")

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, v: str) -> str:
        return _validate_student_id(v)


class LoginResponse(BaseModel):
    firebase_token: str
    role: str
    class_num: int | None
    centre_id: str


class PinResetRequest(BaseModel):
    student_id: str = Field(min_length=10, max_length=20)
    new_pin: str = Field(min_length=4, max_length=6, pattern=r"^\d{4,6}$")

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, v: str) -> str:
        return _validate_student_id(v)


class PingResponse(BaseModel):
    status: str = "ok"
    version: str
