"""Strict content payload validation."""
from shared.errors import ApiError
from shared.validation import fields, text, integer, version
from shared.tiptap_validator import validate_document, validate_revision_size


def invalid(field, message="Invalid value."):
    raise ApiError(400, "VALIDATION_ERROR", message, [{"field": field, "message": message}])


def  array(value, field, maximum=500):
    if not isinstance(value, list) or len(value) > maximum:
        invalid(field)
    return value


def content_payload(body, kind, updating=False):
    specifications = {
        "LESSON": ("title summary keyPoints sentiment preparation progression sections scriptureText scriptureReference level sublevel lessonNumber durationMinutes", "title level sublevel lessonNumber durationMinutes"),
        "PROGRAM": ("title description level sublevel scheduleColumns schedule", "title level sublevel scheduleColumns schedule"),
        "REFERENCE": ("title category content", "title category content"),
    }
    allowed, required = specifications[kind]
    fields(body, set(allowed.split()) | ({"version"} if updating else set()), required.split())
    if updating:
        version(body)
    result = {}
    for name in allowed.split():
        if name in {"title", "summary", "scriptureText", "scriptureReference", "level", "sublevel", "description", "category"}:
            result[name] = text(body.get(name, ""), name, required=name in required.split(), max_length=20000 if name == "scriptureText" else 2000)
    docs = []
    def document(value):
        doc = validate_document(value, allow_images=kind == "LESSON")
        docs.append(doc)
        return doc
    if kind == "LESSON":
        for name in ("lessonNumber", "durationMinutes"):
            result[name] = integer(body.get(name), name, minimum=1, maximum=10000)
        for name in ("keyPoints", "sentiment", "preparation"):
            result[name] = document(body.get(name, {"type": "doc", "content": []}))
        result["progression"] = []
        for row in array(body.get("progression", []), "progression", 200):
            fields(row, {"teacherActivity", "learnerActivity"}, ("teacherActivity", "learnerActivity"))
            result["progression"].append({key: document(row[key]) for key in ("teacherActivity", "learnerActivity")})
        result["sections"] = []
        keys = set()
        for row in array(body.get("sections", []), "sections", 100):
            fields(row, {"key", "title", "content"}, ("key", "title", "content"))
            key = text(row["key"], "sections.key", max_length=100)
            if key in keys:
                invalid("sections.key", "Duplicate section key.")
            keys.add(key)
            result["sections"].append({"key": key, "title": text(row["title"], "sections.title", max_length=500), "content": document(row["content"])})
    elif kind == "REFERENCE":
        if result["category"] not in ("Sinh hoạt", "Kỹ năng"):
            invalid("category")
        result["content"] = document(body["content"])
    else:
        columns, ids = [], []
        for column in array(body["scheduleColumns"], "scheduleColumns", 30):
            fields(column, {"id", "label"}, ("id", "label"))
            column_id = text(column["id"], "scheduleColumns.id", max_length=100)
            if column_id in ids:
                invalid("scheduleColumns.id", "Duplicate column ID.")
            ids.append(column_id)
            columns.append({"id": column_id, "label": text(column["label"], "scheduleColumns.label", max_length=500)})
        if not columns:
            invalid("scheduleColumns")
        rows, row_ids = [], set()
        for row in array(body["schedule"], "schedule", 500):
            fields(row, {"id", "values", "mergedCellGroups"}, ("id", "values"))
            row_id = text(row["id"], "schedule.id", max_length=100)
            if row_id in row_ids:
                invalid("schedule.id", "Duplicate row ID.")
            row_ids.add(row_id)
            values = row["values"]
            if not isinstance(values, dict) or set(values) != set(ids):
                invalid("schedule.values", "Every configured column must retain its value.")
            merged, used = [], set()
            for group in array(row.get("mergedCellGroups", []), "mergedCellGroups", 30):
                array(group, "mergedCellGroups", 30)
                if len(group) < 2 or any(not isinstance(x, str) or x not in ids for x in group):
                    invalid("mergedCellGroups")
                positions = [ids.index(x) for x in group]
                if positions != list(range(positions[0], positions[0] + len(positions))) or used.intersection(group):
                    invalid("mergedCellGroups", "Merged columns must be adjacent and non-overlapping.")
                used.update(group)
                merged.append(group)
            rows.append({"id": row_id, "values": {key: document(value) for key, value in values.items()}, "mergedCellGroups": merged})
        result.update(scheduleColumns=columns, schedule=rows)
    validate_revision_size(docs)
    return result
