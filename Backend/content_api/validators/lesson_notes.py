import re
from shared.errors import ApiError
from shared.validation import fields, version


def identifier(value, uuid=False):
    pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' if uuid else r'lesson_[a-zA-Z0-9_-]{1,100}'
    if not isinstance(value, str) or not re.fullmatch(pattern, value):
        raise ApiError(400, 'VALIDATION_ERROR', 'Mã bài hoặc ghi chú không hợp lệ.')
    return value


def body_text(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 8000:
        raise ApiError(400, 'VALIDATION_ERROR', 'Ghi chú cần có nội dung, tối đa 8000 ký tự.')
    return value


def validate(body, creating=False, deleting=False):
    fields(body, {'noteId', 'anchor', 'body'} if creating else {'version'} if deleting else {'body', 'version'})
    if deleting:
        return {'version': version(body)}
    result = {'body': body_text(body.get('body'))}
    if creating:
        result.update(noteId=identifier(body.get('noteId'), True), anchor=body.get('anchor'))
    else:
        result['version'] = version(body)
    return result
