from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from app.core.deps import TeacherDep, StudentDep, DBDep
from app.core.limiter import limiter
from app.middleware.safeguarding import tier1_scan, SAFE_REDIRECT_MESSAGE
from app.models.test import Test, Question
from app.repositories.chunk_repo import ChunkRepository
from app.schemas.quiz import (
    QuizGenerateRequest, QuizGenerateResponse,
    QuizPublishRequest, PublishedQuizDTO,
)
from app.services.retrieval import RetrievalService

router = APIRouter()

VALID_SUBJECTS = {"mathematics", "science", "hindi", "social_science", "english"}


@router.post("/generate", response_model=QuizGenerateResponse)
@limiter.limit("20/minute")
async def generate_quiz(
    request: Request,
    body: QuizGenerateRequest,
    teacher: TeacherDep,
    db: DBDep,
) -> QuizGenerateResponse:
    if body.subject.lower().strip() not in VALID_SUBJECTS:
        raise HTTPException(status_code=422, detail="Invalid subject")

    if body.class_num not in range(1, 11):
        raise HTTPException(status_code=422, detail="Invalid class_num")

    chunk_repo = ChunkRepository(db)
    service = RetrievalService(chunk_repo, db_session=db)

    result: QuizGenerateResponse = await service.retrieve(
        query=f"Generate quiz for class {body.class_num} {body.subject}",
        class_num=body.class_num,
        subject=body.subject.lower().strip(),
        chapter=body.chapter,
        mode="quiz",
        session_history=[],
        trace_id=getattr(request.state, "trace_id", None),
    )

    if not result.mcqs and not result.short_answers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No textbook content found for this subject/chapter. Ask your admin to upload the textbook first.",
        )

    if tier1_scan(result.plain_text):
        raise HTTPException(status_code=500, detail="Unable to generate quiz. Please try again.")

    return result


@router.post("/publish")
async def publish_quiz(
    body: QuizPublishRequest,
    teacher: TeacherDep,
    db: DBDep,
):
    """Publish a set of MCQs as a test for students of a given class."""
    subj = body.subject.lower().strip()
    if subj not in VALID_SUBJECTS:
        raise HTTPException(status_code=422, detail="Invalid subject")

    test = Test(
        title=body.title,
        created_by=teacher.student_id,
        centre_id=teacher.centre_id,
        class_num=body.class_num,
        subject=subj,
        chapter=body.chapter,
        total_marks=len(body.mcqs),
    )
    db.add(test)
    await db.flush()

    for mcq in body.mcqs:
        q = Question(
            test_id=test.test_id,
            question_no=mcq.question_no,
            question_text=mcq.question,
            option_a=mcq.options.get("A", ""),
            option_b=mcq.options.get("B", ""),
            option_c=mcq.options.get("C", ""),
            option_d=mcq.options.get("D", ""),
            correct_option=mcq.answer,
            explanation=mcq.explanation or None,
        )
        db.add(q)

    return {"quiz_id": str(test.test_id)}


@router.get("/assigned")
async def assigned_quizzes(
    user: StudentDep,
    db: DBDep,
    class_num: int | None = Query(default=None),
):
    """Return published quizzes for a student's class."""
    cn = class_num or user.class_num or 5

    result = await db.execute(
        select(Test)
        .where(Test.class_num == cn)
        .where(Test.is_active == True)
        .order_by(Test.created_at.desc())
        .limit(20)
    )
    tests = result.scalars().all()

    quizzes: list[dict] = []
    for t in tests:
        qs_result = await db.execute(
            select(Question)
            .where(Question.test_id == t.test_id)
            .order_by(Question.question_no)
        )
        questions = qs_result.scalars().all()
        quizzes.append({
            "quiz_id": str(t.test_id),
            "class_num": t.class_num,
            "subject": t.subject,
            "chapter": t.chapter,
            "title": t.title,
            "published_at": t.created_at.isoformat() if t.created_at else None,
            "mcqs": [
                {
                    "question_no": q.question_no,
                    "question": q.question_text,
                    "options": {"A": q.option_a, "B": q.option_b, "C": q.option_c, "D": q.option_d},
                    "answer": q.correct_option,
                    "explanation": q.explanation or "",
                }
                for q in questions
            ],
        })

    return {"quizzes": quizzes}
