"""Validate the TipTap subset emitted by the frontend; no arbitrary HTML or CSS."""
import json
import re
from copy import deepcopy
from shared.errors import ApiError

MAX_RICH_TEXT_BYTES = 200 * 1024
MAX_DEPTH = 24
MAX_NODES = 12000
BLOCKS = {"paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem", "codeBlock",
          "horizontalRule", "columns", "column"}
INLINE = {"text", "hardBreak", "image"}
NODES = BLOCKS | INLINE | {"doc"}
MARKS = {"bold", "italic", "strike", "underline", "code", "link", "textStyle"}
FONTS = {"Georgia, serif", "Arial, sans-serif", "var(--font-sans), sans-serif", "'Times New Roman', serif"}
ATTRS = {
    "paragraph": {"textAlign", "indent"}, "heading": {"level", "textAlign", "indent"},
    "orderedList": {"start", "type"}, "codeBlock": {"language"}, "columns": {"columns"},
    "image": {"mediaId", "alt", "width", "alignment"},
    "textStyle": {"color", "fontSize", "fontFamily"},
    "link": {"href", "target", "rel", "class"},
}


def bad(message):
    raise ApiError(400, "VALIDATION_ERROR", message)


def _attrs(kind, attrs):
    if not isinstance(attrs, dict) or set(attrs) - ATTRS.get(kind, set()):
        bad("Thuộc tính rich text không được phép.")
    for name, value in attrs.items():
        if value is None:
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
        if name == "width" and (type(value) is not int or value not in {140, 220, 320}):
            bad("Kích thước ảnh không hợp lệ.")
        if name == "alignment" and value not in {"left", "center", "right"}:
            bad("Căn ảnh không hợp lệ.")
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
        if parent in {"doc", "column", "blockquote", "listItem"} and kind not in BLOCKS:
            bad("Block container chỉ nhận block nodes.")
        if parent in {"bulletList", "orderedList"} and kind != "listItem":
            bad("List chỉ nhận listItem.")
        if parent == "columns" and kind != "column":
            bad("Columns chỉ nhận column.")
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
        if not isinstance(marks, list) or (marks and kind != "text") or len(marks) > 10:
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
        for child in content:
            walk(child, kind, depth + 1)

    walk(document, None, 0)
    return deepcopy(document)


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
