"""
Tags each chunk with the 11-field metadata schema.
Called after chunking, before embedding.
"""
import re
from dataclasses import dataclass, field

VALID_SECTION_TYPES = {
    "explanation", "exercise", "summary", "glossary",
    "diagram", "poem_explanation", "grammar_rule", "writing_format",
}
VALID_MATH_TYPES = {"procedural", "conceptual", "geometric", "word_problem"}
LATEX_PATTERN = re.compile(r"\$(.*?)\$", re.DOTALL)


@dataclass
class ChunkMetadata:
    class_num: int
    subject: str
    chapter: str | None
    section_type: str
    math_type: str | None
    contains_formula: bool
    latex_equations: list[str]
    diagram_image_path: str | None
    text_content: str
    source_pdf: str
    language: str = "en"
    page_num: int | None = None


def tag_chunk(
    text: str,
    class_num: int,
    subject: str,
    chapter: str | None,
    source_pdf: str,
    page_num: int | None = None,
    language: str = "en",
    section_hint: str = "explanation",
    diagram_path: str | None = None,
) -> ChunkMetadata:
    latex_eqs = LATEX_PATTERN.findall(text)
    contains_formula = len(latex_eqs) > 0

    math_type = _infer_math_type(text, subject)
    section_type = section_hint if section_hint in VALID_SECTION_TYPES else "explanation"

    return ChunkMetadata(
        class_num=class_num,
        subject=subject,
        chapter=chapter,
        section_type=section_type,
        math_type=math_type,
        contains_formula=contains_formula,
        latex_equations=latex_eqs,
        diagram_image_path=diagram_path,
        text_content=text,
        source_pdf=source_pdf,
        language=language,
        page_num=page_num,
    )


def _infer_math_type(text: str, subject: str) -> str | None:
    if subject != "mathematics":
        return None
    lower = text.lower()
    if any(w in lower for w in [
        "triangle", "circle", "angle", "area", "perimeter", "quadrilateral",
        "त्रिभुज", "वृत्त", "कोण", "क्षेत्रफल", "परिमाप", "चतुर्भुज",
    ]):
        return "geometric"
    if any(w in lower for w in [
        "word problem", "a man", "a train", "if there are", "find the",
        "एक व्यक्ति", "एक रेलगाड़ी", "ज्ञात कीजिए", "कितने",
    ]):
        return "word_problem"
    if any(w in lower for w in [
        "solve", "simplify", "calculate", "evaluate", "find x",
        "हल कीजिए", "सरल कीजिए", "गणना कीजिए", "मान ज्ञात",
    ]):
        return "procedural"
    return "conceptual"
