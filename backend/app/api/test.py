import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

from app.core.deps import StudentDep, DBDep
from app.core.limiter import limiter
from app.middleware.safeguarding import tier1_scan, SAFE_REDIRECT_MESSAGE
from app.models.test import Test, Question
from app.models.attempt import TestAttempt, AttemptAnswer
from app.repositories.test_repo import TestRepository
from app.repositories.attempt_repo import AttemptRepository
from app.repositories.chunk_repo import ChunkRepository
from app.schemas.test import (
    TestGenerateRequest, TestGenerateResponse,
    TestAnswerRequest, TestAnswerResponse,
    TestResultResponse,
    MyTestEntry, MyTestsResponse,
    ResumeQuestionOut, TestResumeResponse,
    QuestionOption,
)
from app.services.retrieval import RetrievalService

router = APIRouter()

VALID_SUBJECTS = {"mathematics", "science", "hindi", "social_science", "english"}


@router.post("/generate", response_model=TestGenerateResponse)
@limiter.limit("10/minute")
async def generate_test(
    request: Request,
    body: TestGenerateRequest,
    user: StudentDep,
    db: DBDep,
) -> TestGenerateResponse:
    if body.subject.lower().strip() not in VALID_SUBJECTS:
        raise HTTPException(status_code=422, detail="Invalid subject")

    chunk_repo = ChunkRepository(db)
    service = RetrievalService(chunk_repo, db_session=db)

    question_list, raw_questions = await service.retrieve(
        query=f"Generate 5 MCQs for {body.subject}",
        class_num=user.class_num or 5,
        subject=body.subject.lower().strip(),
        chapter=body.chapter,
        mode="test",
        session_history=[],
        medium=body.medium,
        trace_id=getattr(request.state, "trace_id", None),
    )

    if not question_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No textbook content found for this subject/chapter. Ask your admin to upload the textbook first.",
        )

    # Scan ALL generated question text before saving or returning
    for raw_q in raw_questions:
        q_text = raw_q.get("question_text", "")
        if tier1_scan(q_text):
            raise HTTPException(status_code=500, detail="Unable to generate test. Please try again.")

    # Persist test + questions
    test_repo = TestRepository(db)
    test = Test(
        title=f"{body.subject.title()} Test",
        created_by=user.student_id,
        centre_id=user.centre_id,
        class_num=user.class_num or 5,
        subject=body.subject.lower().strip(),
        chapter=body.chapter,
    )
    test = await test_repo.create(test)

    for i, (q_out, raw_q) in enumerate(zip(question_list, raw_questions)):
        question = Question(
            test_id=test.test_id,
            question_no=i + 1,
            question_text=raw_q["question_text"],
            option_a=raw_q["option_a"],
            option_b=raw_q["option_b"],
            option_c=raw_q["option_c"],
            option_d=raw_q["option_d"],
            correct_option=raw_q["correct_option"],
            explanation=raw_q.get("explanation", ""),
            math_type=raw_q.get("math_type"),
        )
        db.add(question)

    await db.flush()

    # Create attempt record
    attempt_repo = AttemptRepository(db)
    attempt = TestAttempt(test_id=test.test_id, student_id=user.student_id)
    await attempt_repo.create(attempt)

    # Re-query to get question IDs
    test_with_qs = await test_repo.get_by_id(test.test_id)

    from app.schemas.test import QuestionOut, QuestionOption
    questions_out = [
        QuestionOut(
            question_id=q.question_id,
            question_no=q.question_no,
            question_text=q.question_text,
            options=QuestionOption(A=q.option_a, B=q.option_b, C=q.option_c, D=q.option_d),
            has_math="$" in q.question_text,
        )
        for q in sorted(test_with_qs.questions, key=lambda x: x.question_no)
    ]

    return TestGenerateResponse(test_id=test.test_id, questions=questions_out)


@router.post("/answer", response_model=TestAnswerResponse)
@limiter.limit("60/minute")
async def submit_answer(
    request: Request,
    body: TestAnswerRequest,
    user: StudentDep,
    db: DBDep,
) -> TestAnswerResponse:
    test_repo = TestRepository(db)
    attempt_repo = AttemptRepository(db)

    test = await test_repo.get_by_id(body.test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    attempt = await attempt_repo.get_by_test_and_student(body.test_id, user.student_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.submitted_at:
        raise HTTPException(status_code=400, detail="Test already submitted")

    question = await test_repo.get_question(body.question_id)
    if not question or question.test_id != test.test_id:
        raise HTTPException(status_code=404, detail="Question not found")

    is_correct = body.answer.upper() == question.correct_option.upper()

    answer_row = AttemptAnswer(
        attempt_id=attempt.attempt_id,
        question_id=question.question_id,
        student_answer=body.answer,
        is_correct=is_correct,
    )
    await attempt_repo.add_answer(answer_row)

    answer_count = await attempt_repo.count_answers(attempt.attempt_id)
    total_questions = len(test.questions)
    questions_remaining = total_questions - answer_count

    # Auto-submit when all answered
    if questions_remaining == 0:
        correct_count = sum(
            1 for a in (await attempt_repo.get(attempt.attempt_id)).answer_rows
            if a.is_correct
        )
        attempt.score = correct_count
        attempt.submitted_at = datetime.now(timezone.utc)
        await db.flush()

    return TestAnswerResponse(
        is_correct=is_correct,
        correct_option=question.correct_option,
        explanation=question.explanation or "",
        score_so_far=sum(
            1 for a in (await attempt_repo.get(attempt.attempt_id)).answer_rows
            if a.is_correct
        ),
        questions_remaining=max(0, questions_remaining),
    )


@router.get("/result/{test_id}", response_model=TestResultResponse)
async def get_result(test_id: uuid.UUID, user: StudentDep, db: DBDep) -> TestResultResponse:
    attempt_repo = AttemptRepository(db)
    attempt = await attempt_repo.get_by_test_and_student(test_id, user.student_id)

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    test_repo = TestRepository(db)
    test = await test_repo.get_by_id(test_id)
    total = len(test.questions) if test else 10

    wrong_answers = [a for a in attempt.answer_rows if not a.is_correct]
    weak_topics: list[str] = []
    math_breakdown: dict[str, int] = {}

    for a in wrong_answers:
        q = await test_repo.get_question(a.question_id)
        if q:
            weak_topics.append(q.question_text[:80])
            if q.math_type:
                math_breakdown[q.math_type] = math_breakdown.get(q.math_type, 0) + 1

    return TestResultResponse(
        score=attempt.score or 0,
        total=total,
        weak_topics=weak_topics[:5],
        math_type_breakdown=math_breakdown,
    )


@router.get("/my-tests", response_model=MyTestsResponse)
async def list_my_tests(user: StudentDep, db: DBDep) -> MyTestsResponse:
    test_repo = TestRepository(db)
    tests = await test_repo.list_by_student(user.student_id)

    entries: list[MyTestEntry] = []
    for t in tests:
        attempt = next((a for a in t.attempts if a.student_id == user.student_id), None)
        if not attempt:
            continue
        answered = len(attempt.answer_rows)
        is_submitted = attempt.submitted_at is not None
        entries.append(MyTestEntry(
            test_id=t.test_id,
            title=t.title,
            subject=t.subject,
            chapter=t.chapter,
            created_at=t.created_at.isoformat(),
            status="completed" if is_submitted else "in_progress",
            score=attempt.score,
            total=len(t.questions),
            questions_answered=answered,
            is_ai_generated=(t.created_by == user.student_id),
        ))

    return MyTestsResponse(tests=entries)


@router.get("/resume/{test_id}", response_model=TestResumeResponse)
async def resume_test(test_id: uuid.UUID, user: StudentDep, db: DBDep) -> TestResumeResponse:
    test_repo = TestRepository(db)
    attempt_repo = AttemptRepository(db)

    test = await test_repo.get_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    attempt = await attempt_repo.get_by_test_and_student(test_id, user.student_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    answered_map: dict[uuid.UUID, AttemptAnswer] = {
        a.question_id: a for a in attempt.answer_rows
    }

    sorted_qs = sorted(test.questions, key=lambda x: x.question_no)
    questions_out: list[ResumeQuestionOut] = []
    first_unanswered = len(sorted_qs)

    for i, q in enumerate(sorted_qs):
        ans = answered_map.get(q.question_id)
        if ans:
            questions_out.append(ResumeQuestionOut(
                question_id=q.question_id,
                question_no=q.question_no,
                question_text=q.question_text,
                options=QuestionOption(A=q.option_a, B=q.option_b, C=q.option_c, D=q.option_d),
                has_math="$" in q.question_text,
                student_answer=ans.student_answer,
                is_correct=ans.is_correct,
                correct_option=q.correct_option,
                explanation=q.explanation or "",
            ))
        else:
            if i < first_unanswered:
                first_unanswered = i
            questions_out.append(ResumeQuestionOut(
                question_id=q.question_id,
                question_no=q.question_no,
                question_text=q.question_text,
                options=QuestionOption(A=q.option_a, B=q.option_b, C=q.option_c, D=q.option_d),
                has_math="$" in q.question_text,
            ))

    score_so_far = sum(1 for a in attempt.answer_rows if a.is_correct)

    return TestResumeResponse(
        test_id=test.test_id,
        title=test.title,
        subject=test.subject,
        chapter=test.chapter,
        questions=questions_out,
        current_index=first_unanswered,
        score_so_far=score_so_far,
    )


@router.delete("/{test_id}")
async def delete_test(test_id: uuid.UUID, user: StudentDep, db: DBDep):
    test_repo = TestRepository(db)
    test = await test_repo.get_by_id(test_id)

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.created_by != user.student_id:
        raise HTTPException(status_code=403, detail="You can only delete your own AI-generated tests")

    await test_repo.delete(test_id)
    return {"success": True}
