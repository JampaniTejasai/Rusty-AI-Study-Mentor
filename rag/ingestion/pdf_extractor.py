"""
Extracts text from Bihar Board PDF textbooks using PyMuPDF (fitz).
Uses block-level extraction to preserve tables and math layout.
"""
import re
import fitz


_TABLE_COL_GAP = 20
_MIN_TABLE_COLS = 2
_MIN_TABLE_ROWS = 2


def extract_pages(pdf_path: str) -> list[dict]:
    """
    Returns a list of {page_num, text} dicts.
    Uses block-level extraction to detect tables and preserve structure.
    Skips pages with < 50 chars (cover pages, blank pages).
    """
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        text = _extract_page(page)
        if len(text) < 50:
            continue
        pages.append({"page_num": i + 1, "text": text})
    doc.close()
    return pages


def _extract_page(page: fitz.Page) -> str:
    """Extract a single page with table detection and math preservation."""
    blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

    text_blocks = []
    for b in blocks:
        if b["type"] == 1:
            continue
        lines_data = _extract_block_lines(b)
        if not lines_data:
            continue
        text_blocks.append({
            "bbox": b["bbox"],
            "lines": lines_data,
        })

    if not text_blocks:
        return ""

    table_groups = _detect_table_blocks(text_blocks)
    result_parts = []

    for tb in text_blocks:
        tb_id = id(tb)
        if tb_id in table_groups:
            table_md = table_groups[tb_id]
            if table_md:
                result_parts.append(table_md)
                table_groups[tb_id] = None
        else:
            block_text = _render_block(tb)
            if block_text.strip():
                result_parts.append(block_text)

    return "\n\n".join(result_parts).strip()


def _extract_block_lines(block: dict) -> list[dict]:
    """Extract line data from a block dict."""
    lines = []
    for line in block.get("lines", []):
        spans = line.get("spans", [])
        if not spans:
            continue
        text = "".join(s["text"] for s in spans)
        if not text.strip():
            continue
        avg_size = sum(s["size"] for s in spans) / len(spans)
        is_bold = any(("bold" in s.get("font", "").lower()) for s in spans)
        is_superscript = any(
            s.get("flags", 0) & 1 for s in spans
        )
        lines.append({
            "text": text,
            "bbox": line["bbox"],
            "size": avg_size,
            "bold": is_bold,
            "has_super": is_superscript,
            "spans": spans,
        })
    return lines


def _render_block(tb: dict) -> str:
    """Render a text block, preserving math superscripts and structure."""
    parts = []
    for line in tb["lines"]:
        rendered = _render_line_with_math(line)
        parts.append(rendered)
    return "\n".join(parts)


def _render_line_with_math(line: dict) -> str:
    """Render a line, converting superscript spans to math notation."""
    spans = line.get("spans", [])
    if not spans:
        return line["text"]

    if not line.get("has_super"):
        return line["text"]

    parts = []
    base_size = max((s["size"] for s in spans), default=12)
    for s in spans:
        text = s["text"]
        is_super = (s.get("flags", 0) & 1) or (s["size"] < base_size * 0.75)
        if is_super and text.strip():
            parts.append(f"^{text.strip()}")
        else:
            parts.append(text)
    return "".join(parts)


def _detect_table_blocks(text_blocks: list[dict]) -> dict:
    """
    Detect groups of blocks that form a table based on vertical alignment.
    Returns {block_id: markdown_table_string | None}.
    """
    result = {}
    if len(text_blocks) < _MIN_TABLE_ROWS:
        return result

    column_groups = _find_aligned_columns(text_blocks)
    if not column_groups:
        return result

    for group in column_groups:
        if len(group) < _MIN_TABLE_ROWS:
            continue
        table_md = _blocks_to_markdown_table(group)
        if table_md:
            for tb in group:
                result[id(tb)] = table_md
            for tb in group[1:]:
                result[id(tb)] = None

    return result


def _find_aligned_columns(text_blocks: list[dict]) -> list[list[dict]]:
    """Find groups of consecutive blocks that share column alignment (tables)."""
    groups = []
    current_group = []

    for i, tb in enumerate(text_blocks):
        line_x_positions = []
        for line in tb["lines"]:
            for s in line.get("spans", []):
                line_x_positions.append(round(s["bbox"][0] / _TABLE_COL_GAP))

        unique_cols = len(set(line_x_positions))

        if unique_cols >= _MIN_TABLE_COLS and len(tb["lines"]) == 1:
            current_group.append(tb)
        else:
            if len(current_group) >= _MIN_TABLE_ROWS:
                groups.append(current_group)
            current_group = []

    if len(current_group) >= _MIN_TABLE_ROWS:
        groups.append(current_group)

    return groups


def _blocks_to_markdown_table(blocks: list[dict]) -> str | None:
    """Convert aligned blocks to a markdown table."""
    rows = []
    for tb in blocks:
        cells = []
        for line in tb["lines"]:
            spans_by_col: dict[int, list[str]] = {}
            for s in line.get("spans", []):
                col = round(s["bbox"][0] / _TABLE_COL_GAP)
                spans_by_col.setdefault(col, []).append(s["text"].strip())
            for col in sorted(spans_by_col):
                cell_text = " ".join(spans_by_col[col]).strip()
                if cell_text:
                    cells.append(cell_text)
        if cells:
            rows.append(cells)

    if len(rows) < _MIN_TABLE_ROWS:
        return None

    max_cols = max(len(r) for r in rows)
    for r in rows:
        while len(r) < max_cols:
            r.append("")

    lines = []
    header = "| " + " | ".join(rows[0]) + " |"
    separator = "| " + " | ".join("---" for _ in rows[0]) + " |"
    lines.append(header)
    lines.append(separator)
    for row in rows[1:]:
        lines.append("| " + " | ".join(row) + " |")

    return "\n".join(lines)
