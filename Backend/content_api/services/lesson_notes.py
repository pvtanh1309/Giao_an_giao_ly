from shared.db import Store
from shared.models import now, public
from shared.errors import ApiError
from shared.personal_account import own_account
from content_api.services.content import Content
from content_api.services.note_anchors import validate_anchor
from content_api.validators.lesson_notes import validate, identifier
from content_api.repositories.lesson_notes import note_key, quota_key, guards


def context(request, principal, published=True):
    store = Store()
    account = own_account(store, principal)
    lesson_id = identifier(request['path_parameters'].get('lessonId'))
    items = Content('LESSON', store).load(request) if published else None
    if items is not None and 'PUBLISHED' not in items:
        raise ApiError(404, 'NOT_FOUND', 'Bài chưa được xuất bản.')
    return store, account, lesson_id, items


def list_notes(request, principal):
    store, account, lesson_id, _ = context(request, principal)
    if request.get('query'):
        raise ApiError(400, 'VALIDATION_ERROR', 'Truy vấn ghi chú không hợp lệ.')
    rows = store.query_prefix(account['PK'], 'LESSONNOTE#' + lesson_id + '#')
    return sorted((public(row) for row in rows), key=lambda row: (row['createdAt'], row['noteId']))


def create(request, principal):
    payload = validate(request['body'], creating=True)
    store, account, lesson_id, items = context(request, principal)
    key = note_key(principal['sub'], lesson_id, payload['noteId'])
    for _ in range(3):
        existing = store.get(key['PK'], key['SK'])
        if existing:
            if existing['body'] == payload['body'] and existing['anchor'] == payload['anchor']:
                return public(existing)
            raise ApiError(409, 'VERSION_CONFLICT', 'Ghi chú này đã có nội dung khác. Hãy tải lại.')
        anchor = validate_anchor(items['PUBLISHED'], payload['anchor'])
        qkey = quota_key(principal['sub'], lesson_id)
        quota = store.get(qkey['PK'], qkey['SK'])
        if quota and quota['count'] >= 100:
            raise ApiError(409, 'NOTE_LIMIT', 'Mỗi bài có tối đa 100 ghi chú riêng.')
        stamp = now()
        note = {**key, 'entityType': 'LESSON_NOTE', 'lessonId': lesson_id, 'noteId': payload['noteId'],
                'anchor': anchor, 'body': payload['body'], 'version': 1, 'createdAt': stamp, 'updatedAt': stamp}
        counter = {**qkey, 'entityType': 'LESSON_NOTE_QUOTA', 'count': int(quota['count']) + 1 if quota else 1,
                   'version': int(quota['version']) + 1 if quota else 1}
        try:
            store.transact(guards(account, items['META']) + [{'put': note, 'create': True},
                {'put': counter, 'version': quota['version']} if quota else {'put': counter, 'create': True}])
            return public(note)
        except ApiError as error:
            if error.code != 'VERSION_CONFLICT':
                raise
    raise ApiError(409, 'VERSION_CONFLICT', 'Dữ liệu đã thay đổi. Hãy tải lại hoặc thử lưu ghi chú lần nữa.')


def update(request, principal):
    payload = validate(request['body'])
    store, account, lesson_id, items = context(request, principal)
    key = note_key(principal['sub'], lesson_id, identifier(request['path_parameters'].get('noteId'), True))
    old = store.get(key['PK'], key['SK'])
    if not old:
        raise ApiError(404, 'NOT_FOUND', 'Không tìm thấy ghi chú của bạn.')
    if old['version'] != payload['version']:
        raise ApiError(409, 'VERSION_CONFLICT', 'Ghi chú đã thay đổi ở tab khác. Hãy tải lại.')
    changed = {**old, 'body': payload['body'], 'version': old['version'] + 1, 'updatedAt': now()}
    store.transact(guards(account, items['META']) + [{'put': changed, 'version': payload['version']}])
    return public(changed)


def remove(request, principal):
    payload = validate(request['body'], deleting=True)
    store, account, lesson_id, _ = context(request, principal, published=False)
    note_id = identifier(request['path_parameters'].get('noteId'), True)
    key, qkey = note_key(principal['sub'], lesson_id, note_id), quota_key(principal['sub'], lesson_id)
    for _ in range(3):
        old, quota = store.get(key['PK'], key['SK']), store.get(qkey['PK'], qkey['SK'])
        if not old:
            return {'noteId': note_id}
        if old['version'] != payload['version']:
            raise ApiError(409, 'VERSION_CONFLICT', 'Ghi chú đã thay đổi ở tab khác. Hãy tải lại.')
        if not quota or quota['count'] < 1:
            raise ApiError(409, 'VERSION_CONFLICT', 'Số lượng ghi chú đã thay đổi. Hãy tải lại.')
        try:
            store.transact(guards(account) + [{'delete': key, 'version': payload['version']},
                {'put': {**quota, 'count': quota['count'] - 1, 'version': quota['version'] + 1}, 'version': quota['version']}])
            return {'noteId': note_id}
        except ApiError as error:
            if error.code != 'VERSION_CONFLICT':
                raise
    raise ApiError(409, 'VERSION_CONFLICT', 'Dữ liệu đã thay đổi. Hãy thử lại.')
