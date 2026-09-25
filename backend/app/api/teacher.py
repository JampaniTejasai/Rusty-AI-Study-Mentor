from datetime import date
from fastapi import APIRouter, Query
from app.core.deps import TeacherDep, DBDep
from app.repositories.score_repo import ScoreRepository

router = APIRouter()

VALID_SUBJECTS = {"mathematics", "science", "hindi", "social_science", "english"}


@router.get("/scores")
async def get_scores(
    teacher: TeacherDep,
    db: DBDep,
    class_num: int | None = Query(default=None, ge=1, le=10),
    subject: str | None = Query(default=None, max_length=50),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> dict:
    if subject and subject.lower().strip() not in VALID_SUBJECTS:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Invalid subject")

    score_repo = ScoreRepository(db)
    scores = await score_repo.get_for_student(
        student_id="",  # teacher sees centre-level data — extend with centre filter
        class_num=class_num,
        subject=subject,
    )

    # Group by student — display_name uses ordinal index (no real names in API)
    student_map: dict[str, list] = {}
    for s in scores:
        student_map.setdefault(s.student_id, []).append(s)

    students_out = []
    for idx, (student_id, student_scores) in enumerate(student_map.items(), start=1):
        avg = sum(s.score for s in student_scores) / len(student_scores) if student_scores else 0
        weak = []
        for s in student_scores:
            if s.weak_topics:
                weak.extend(s.weak_topics)
        students_out.append({
            "student_id": student_id,
            "display_name": f"Student #{idx:03d}",
            "scores": [
                {
                    "score": s.score,
                    "total": s.total,
                    "taken_at": s.taken_at.isoformat(),
                }
                for s in student_scores
            ],
            "average_score": round(avg, 1),
            "weak_topics": list(set(weak))[:5],
        })

    return {"students": students_out}


@router.get("/weak-topics")
async def get_weak_topics(
    teacher: TeacherDep,
    db: DBDep,
    class_num: int = Query(ge=1, le=10),
    subject: str = Query(max_length=50),
) -> dict:
    if subject.lower().strip() not in VALID_SUBJECTS:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Invalid subject")

    score_repo = ScoreRepository(db)
    scores = await score_repo.get_for_student("", class_num=class_num, subject=subject)

    topic_map: dict[str, dict] = {}
    for s in scores:
        if s.weak_topics:
            for topic in s.weak_topics:
                if topic not in topic_map:
                    topic_map[topic] = {"total_score": 0, "count": 0}
                topic_map[topic]["total_score"] += s.score
                topic_map[topic]["count"] += 1

    breakdown = [
        {
            "topic": topic,
            "avg_score": round(v["total_score"] / v["count"], 1),
            "attempt_count": v["count"],
        }
        for topic, v in topic_map.items()
    ]
    breakdown.sort(key=lambda x: x["avg_score"])

    return {"topic_breakdown": breakdown}
