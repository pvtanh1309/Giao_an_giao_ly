"""Canonical lesson text and conservative private-note anchors."""
import hashlib
import re
from shared.errors import ApiError


def canonical_field_text(value):
    if isinstance(value, str):
        return value.replace('\r\n', '\n').replace('\r', '\n')
    if not isinstance(value, dict):
        return ''
    kind = value.get('type')
    if kind == 'text':
        return canonical_field_text(value.get('text', ''))
    if kind == 'hardBreak':
        return '\n'
    if kind == 'image':
        return '\ufffc'
    separator = '' if kind in {'paragraph', 'heading', 'codeBlock'} else '\n'
    return separator.join(canonical_field_text(child) for child in value.get('content', []))


def field_text(revision, field_id):
    if field_id == 'scripture':
        return canonical_field_text(revision.get('scriptureText', ''))
    if field_id in {'keyPoints', 'sentiment', 'preparation'}:
        return canonical_field_text(revision.get(field_id, {}))
    if field_id.startswith('section:'):
        section = next((s for s in revision.get('sections', []) if s['key'] == field_id[8:]), None)
        if section is not None:
            return canonical_field_text(section['content'])
    raise ApiError(409, 'ANCHOR_CHANGED', 'Mục được chọn đã thay đổi. Hãy chọn lại đoạn chữ.')


def digest(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def make_anchor(field_id, text, start, end):
    return {'fieldId': field_id, 'start': start, 'end': end, 'exactQuote': text[start:end],
            'prefix': text[max(0, start - 120):start], 'suffix': text[end:end + 120], 'sourceHash': digest(text)}


def validate_anchor(revision, anchor):
    keys = {'fieldId', 'start', 'end', 'exactQuote', 'prefix', 'suffix', 'sourceHash'}
    if (not isinstance(anchor, dict) or set(anchor) != keys
            or any(not isinstance(anchor[k], str) for k in keys - {'start', 'end'})
            or type(anchor['start']) is not int or type(anchor['end']) is not int
            or not 0 <= anchor['start'] < anchor['end']
            or not anchor['exactQuote'].strip() or len(anchor['exactQuote']) > 2000
            or max(len(anchor['prefix']), len(anchor['suffix'])) > 120
            or len(anchor['fieldId']) > 120 or not re.fullmatch(r'[0-9a-f]{64}', anchor['sourceHash'])):
        raise ApiError(400, 'VALIDATION_ERROR', 'Đoạn ghi chú không hợp lệ.')
    text = field_text(revision, anchor['fieldId'])
    if anchor['end'] > len(text) or make_anchor(anchor['fieldId'], text, anchor['start'], anchor['end']) != anchor:
        raise ApiError(409, 'ANCHOR_CHANGED', 'Đoạn gốc đã thay đổi. Hãy chọn lại đoạn chữ, nội dung ghi chú vẫn được giữ.')
    return dict(anchor)


def resolve_anchor(text, anchor):
    start, end = int(anchor['start']), int(anchor['end'])
    if digest(text) == anchor['sourceHash'] and text[start:end] == anchor['exactQuote']:
        return start, end
    quote, prefix, suffix = anchor['exactQuote'], anchor['prefix'], anchor['suffix']
    matches, offset = [], 0
    while offset <= len(text):
        position = text.find(quote, offset)
        if position < 0:
            break
        end = position + len(quote)
        if text[:position].endswith(prefix) and text[end:].startswith(suffix):
            matches.append((position, end))
        if len(matches) > 1:
            return None
        offset = position + 1
    return matches[0] if len(matches) == 1 else None
