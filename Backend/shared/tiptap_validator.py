"""Validate the TipTap subset emitted by the frontend; no arbitrary HTML or CSS."""
import json
import re
from copy import deepcopy
from shared.errors import ApiError

MAX_RICH_TEXT_BYTES = 200 * 1024
MAX_DEPTH = 24
MAX_NODES = 12000
BLOCKS = {"paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem", "codeBlock",
          "horizontalRule", "columns", "column", "table"}
TABLE_PARTS = {"tableRow", "tableCell", "tableHeader"}
INLINE = {"text", "hardBreak", "image"}
NODES = BLOCKS | INLINE | TABLE_PARTS | {"doc"}
MARKS = {"bold", "italic", "strike", "underline", "code", "link", "textStyle"}
FONTS = {"Georgia, serif", "Arial, sans-serif", "var(--font-sans), sans-serif", "'Times New Roman', serif"}
ATTRS = {
    "paragraph": {"textAlign", "indent"}, "heading": {"level", "textAlign", "indent"},
    "orderedList": {"start", "type"}, "codeBlock": {"language"}, "columns": {"columns"},
    "image": {"mediaId", "alt", "width", "alignment"},
    "tableCell": {"colspan", "rowspan", "colwidth", "align"},
    "tableHeader": {"colspan", "rowspan", "colwidth", "align"},
    "textStyle": {"color", "fontSize", "fontFamily"},
    "link": {"href", "target", "rel", "class"},
}


def bad(message):
    raise ApiError(400, "VALIDATION_ERROR", message)


def _attrs(kind, attrs):
    if not isinstance(attrs, dict) or set(attrs) - ATTRS.get(kind, set()):
        bad("Thuộc tính rich text không được phép.")
    for name, value in attrs.items():
        if value is None or (kind == "textStyle" and value == ""):
            continue
        if name in {"textAlign", "type", "language", "mediaId", "alt", "alignment", "color", "fontSize", "fontFamily", "href", "target", "rel", "class"} and not isinstance(value, str):
            bad("Thuộc tính rich text phải đúng kiểu dữ liệu.")
        if name == "textAlign" and value not in {"left", "center", "right", "justify"}:
            bad("Căn lề không hợp lệ.")
        if name == "indent" and (type(value) is not int or not 0 <= value <= 12):
            bad("Indent không hợp lệ.")
        if name == "level" and (type(value) is not int or not 1 <= value <= 6):
            bad("Heading không hợp lệ.")
        if name == "start" and (type(value) is not int or not 1 <= value <= 10000):
            bad("Số thứ tự không hợp lệ.")
        if name == "type" and value not in {"1", "a", "A", "i", "I"}:
            bad("Kiểu đánh số không hợp lệ.")
        if name == "columns" and (type(value) is not int or value not in {2, 3}):
            bad("Số cột không hợp lệ.")
        if name == "language" and (not isinstance(value, str) or not re.fullmatch(r"[a-zA-Z0-9_+-]{0,30}", value)):
            bad("Language không hợp lệ.")
        if name == "mediaId" and (not isinstance(value, str) or not re.fullmatch(r"media_[a-zA-Z0-9_-]{1,100}", value)):
            bad("mediaId không hợp lệ.")
        if name == "alt" and (not isinstance(value, str) or len(value) > 500):
            bad("Alt không hợp lệ.")
        if name == "width" and (type(value) is not int or not 40 <= value <= 1600):
            bad("Kích thước ảnh không hợp lệ.")
        if name == "alignment" and value not in {"left", "center", "right"}:
            bad("Căn ảnh không hợp lệ.")
        if name == "align" and (not isinstance(value, str) or value not in {"left", "center", "right"}):
            bad("Căn ô bảng không hợp lệ.")
        if name in {"colspan", "rowspan"} and (type(value) is not int or not 1 <= value <= 200):
            bad("Số ô gộp không hợp lệ.")
        if name == "colwidth" and (not isinstance(value, list) or len(value) != attrs.get("colspan", 1)
                                    or any(type(width) not in (int, float) or not 0 <= width <= 10000 for width in value)):
            bad("Độ rộng cột không hợp lệ.")
        if name == "color" and (not isinstance(value, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", value)):
            bad("Màu chữ không hợp lệ.")
        if name == "fontSize" and value not in {f"{n}px" for n in (12, 14, 16, 18, 20, 24, 28, 32)}:
            bad("Cỡ chữ không hợp lệ.")
        if name == "fontFamily" and value not in FONTS:
            bad("Font không hợp lệ.")
        if name == "href" and (not isinstance(value, str) or len(value) > 2000 or
                                not re.match(r"^(https?://|mailto:)", value, re.I) or
                                any(ord(c) < 32 for c in value)):
            bad("Liên kết không hợp lệ.")
        if name == "target" and value not in {"_blank", "_self"}:
            bad("Link target không hợp lệ.")
        if name == "rel" and (not isinstance(value, str) or set(value.split()) - {"noopener", "noreferrer", "nofollow"}):
            bad("Link rel không hợp lệ.")
        if name == "class" and value not in {"", None}:
            bad("Link class không được phép.")


def validate_document(document, allow_images=False):
    validate_revision_size([document])
    if not isinstance(document, dict) or document.get("type") != "doc":
        bad("Rich text phải là TipTap doc object.")
    count = 0

    def walk(node, parent, depth):
        nonlocal count
        count += 1
        if depth > MAX_DEPTH or count > MAX_NODES:
            bad("Rich text quá sâu hoặc có quá nhiều node.")
        if not isinstance(node, dict) or set(node) - {"type", "attrs", "content", "text", "marks"}:
            bad("Node rich text không hợp lệ.")
        kind = node.get("type")
        if not isinstance(kind, str) or kind not in NODES or (kind == "doc" and parent is not None):
            bad("Node rich text không được phép.")
        if parent in {"paragraph", "heading"} and kind not in INLINE:
            bad("Paragraph/heading chỉ nhận inline nodes.")
        if parent in {"doc", "column", "blockquote", "listItem", "tableCell", "tableHeader"} and kind not in BLOCKS:
            bad("Block container chỉ nhận block nodes.")
        if parent in {"bulletList", "orderedList"} and kind != "listItem":
            bad("List chỉ nhận listItem.")
        if parent == "columns" and kind != "column":
            bad("Columns chỉ nhận column.")
        if parent == "table" and kind != "tableRow":
            bad("Bảng chỉ nhận hàng.")
        if parent == "tableRow" and kind not in {"tableCell", "tableHeader"}:
            bad("Hàng chỉ nhận ô bảng.")
        if kind == "tableRow" and parent != "table":
            bad("Hàng phải thuộc bảng.")
        if kind in {"tableCell", "tableHeader"} and parent != "tableRow":
            bad("Ô phải thuộc hàng trong bảng.")
        if parent == "codeBlock" and kind != "text":
            bad("Code block chỉ nhận text.")
        if kind == "column" and parent != "columns":
            bad("Column phải thuộc columns.")
        if kind == "listItem" and parent not in {"bulletList", "orderedList"}:
            bad("listItem phải thuộc list.")
        attrs = node.get("attrs", {})
        _attrs(kind, attrs)
        if kind == "heading" and attrs.get("level") not in range(1, 7):
            bad("Heading phải có level.")
        if kind == "image":
            if not allow_images or not attrs.get("mediaId"):
                bad("Ảnh chỉ được tham chiếu bằng mediaId trong giáo án.")
        if kind == "text":
            if not isinstance(node.get("text"), str) or not node["text"]:
                bad("Text node phải có text.")
        elif "text" in node:
            bad("Chỉ text node có text.")
        marks = node.get("marks", [])
        # Selecting and formatting across a soft break or image can mark those
        # inline nodes too. Validate their marks with the same allowlist as text.
        if not isinstance(marks, list) or (marks and kind not in INLINE) or len(marks) > 10:
            bad("Marks không hợp lệ.")
        for mark in marks:
            if not isinstance(mark, dict) or set(mark) - {"type", "attrs"} or not isinstance(mark.get("type"), str) or mark["type"] not in MARKS:
                bad("Mark không được phép.")
            _attrs(mark["type"], mark.get("attrs", {}))
            if mark["type"] == "link" and not mark.get("attrs", {}).get("href"):
                bad("Link phải có href.")
        content = node.get("content", [])
        if not isinstance(content, list) or (kind in INLINE | {"horizontalRule"} and content):
            bad("Content node không hợp lệ.")
        if kind == "columns" and len(content) != attrs.get("columns", 2):
            bad("Số column không khớp cấu hình.")
        if kind in TABLE_PARTS | {"table"} and not content:
            # A row fully covered by rowspans may legitimately have no own cells.
            if kind != "tableRow":
                bad("Bảng và ô phải có nội dung.")
        for child in content:
            walk(child, kind, depth + 1)
        if kind == "table":
            _validate_table_grid(content)

    walk(document, None, 0)
    result = deepcopy(document)

    def normalize_widths(node):
        # Resizing a merged cell can produce fractional pixel widths. DynamoDB
        # cannot serialize Python floats; store integer pixels in the revision.
        if node.get("type") in {"tableCell", "tableHeader"}:
            attrs = node.get("attrs", {})
            if isinstance(attrs.get("colwidth"), list):
                attrs["colwidth"] = [round(width) for width in attrs["colwidth"]]
        for mark in node.get("marks", []):
            if mark["type"] == "textStyle" and "attrs" in mark:
                mark["attrs"] = {key: value for key, value in mark["attrs"].items() if value != ""}
        for child in node.get("content", []):
            normalize_widths(child)

    normalize_widths(result)
    return result


def _validate_table_grid(rows):
    """Reject overlapping/ragged spans before the editor repairs malformed tables."""
    if len(rows) > 200:
        bad("Bảng không được vượt quá 200 hàng.")
    occupied = set()
    widths = []
    for row_index, row in enumerate(rows):
        column = 0
        for cell in row.get("content", []):
            while (row_index, column) in occupied:
                column += 1
            attrs = cell.get("attrs", {})
            colspan, rowspan = attrs.get("colspan", 1), attrs.get("rowspan", 1)
            if colspan is None or rowspan is None or column + colspan > 40 or row_index + rowspan > len(rows):
                bad("Kích thước hoặc ô gộp của bảng không hợp lệ.")
            for r in range(row_index, row_index + rowspan):
                for c in range(column, column + colspan):
                    if (r, c) in occupied:
                        bad("Các ô gộp của bảng chồng lấn.")
                    occupied.add((r, c))
            column += colspan
        widths.append(sum((row_index, c) in occupied for c in range(40)))
    if len(set(widths)) != 1 or not widths[0] or len(occupied) != len(rows) * widths[0]:
        bad("Số cột giữa các hàng không khớp.")


def validate_revision_size(documents):
    try:
        size = sum(len(json.dumps(doc, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8"))
                   for doc in documents)
    except (ValueError, TypeError, RecursionError):
        bad("Rich text không phải JSON hợp lệ.")
    if size > MAX_RICH_TEXT_BYTES:
        raise ApiError(413, "CONTENT_TOO_LARGE", "Tổng rich text vượt 200 KB.")


def validate_revision(documents):
    validate_revision_size(documents)


def media_ids(value):
    result = set()
    if isinstance(value, dict):
        if value.get("type") == "image" and value.get("attrs", {}).get("mediaId"):
            result.add(value["attrs"]["mediaId"])
        for child in value.values():
            result.update(media_ids(child))
    elif isinstance(value, list):
        for child in value:
            result.update(media_ids(child))
    return result
