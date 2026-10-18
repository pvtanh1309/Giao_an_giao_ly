"""Private profile/note UI fixture; real route/auth/service code, offline storage."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl
root = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(root / 'Backend'), str(root / 'Backend/tests')]
from test_lesson_notes import NotesStore
from content_api.services.content import Content
from content_api.services import content, lesson_notes
from users_api.services import me, catechists
from shared import auth
from shared.http import handle
from content_api.routes import ROUTES as CONTENT
from users_api.routes import ROUTES as USERS

store = NotesStore()
for module in [lesson_notes, me, auth, catechists]:
    module.Store = lambda: store
content.get_store = lambda: store
for sub, name in [('local-ui-reader', 'Maria Lan'), ('local-ui-other', 'Giuse Minh'), ('local-ui-admin', 'Admin')]:
    cat = 'cat-' + sub
    store.items[('ACCOUNT#' + sub, 'PROFILE')] = {'PK': 'ACCOUNT#' + sub, 'SK': 'PROFILE', 'entityType': 'ACCOUNT', 'cognitoSub': sub,
        'role': 'ADMIN' if sub.endswith('admin') else 'READER', 'accountStatus': 'ACTIVE', 'catechistId': cat, 'email': sub + '@example.test', 'version': 1}
    store.items[('CATECHIST#' + cat, 'PROFILE')] = {'PK': 'CATECHIST#' + cat, 'SK': 'PROFILE', 'entityType': 'CATECHIST', 'catechistId': cat,
        'name': name, 'email': 'contact@example.test', 'phone': '', 'group': 'Ấu 1', 'accompanyingClass': '', 'status': 'ACTIVE', 'version': 1}
lesson = {'title': 'Giáo án ghi chú riêng', 'level': 'Ấu Nhi', 'sublevel': 'Ấu 1', 'lessonNumber': 1, 'durationMinutes': 45,
          'scriptureText': 'Lời Chúa cho con', 'keyPoints': {'type': 'doc', 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'A😀B Việt Nam'}]}]}}
principal = {'sub': 'local-ui-admin', 'groups': ('admin',)}
created = Content('LESSON', store).create_draft({'body': lesson}, principal)
lesson_id = created['lessonId']
Content('LESSON', store).publish({'body': {'version': 1}, 'path_parameters': {'lessonId': lesson_id}}, principal)

routes = {**CONTENT, **USERS}
for line in sys.stdin:
    job = json.loads(line)
    url = urlsplit(job['url'])
    result = {'statusCode': 404, 'body': '{}'}
    for route in routes:
        method, pattern = route.split(' ', 1)
        match = re.fullmatch(re.sub(r'\{([^}]+)\}', r'(?P<\1>[^/]+)', pattern), url.path)
        if method != job['method'] or not match:
            continue
        event = {'routeKey': route, 'pathParameters': match.groupdict(), 'queryStringParameters': dict(parse_qsl(url.query)),
                 'body': json.dumps(job.get('body', {})), 'requestContext': {'requestId': 'ui-test', 'authorizer': {'jwt': {'claims': {
                     'sub': job['sub'], 'token_use': 'access', 'cognito:groups': [job['role']]}}}}}
        result = handle(event, None, routes, lambda *_: None)
        break
    print(json.dumps({'id': job['id'], 'status': result['statusCode'], 'body': json.loads(result['body'])}, ensure_ascii=False), flush=True)
