"""Local UI probe: real content services/validators, offline in-memory storage."""
import json
import sys
from urllib.parse import urlsplit, parse_qsl
from pathlib import Path

root = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(root / 'Backend'), str(root / 'Backend/tests')]
from test_content import MemoryStore
from content_api.services.content import Content
from shared.errors import ApiError

store = MemoryStore()
for line in sys.stdin:
    job = json.loads(line)
    try:
        url = urlsplit(job['url'])
        parts = url.path.strip('/').split('/')
        management = parts[0] == 'manage'
        if management:
            parts = parts[1:]
        kind = {'lessons': 'LESSON', 'programs': 'PROGRAM', 'references': 'REFERENCE'}[parts[0]]
        service = Content(kind, store)
        request = {'body': job.get('body') or {}, 'query': dict(parse_qsl(url.query)),
                   'path_parameters': {kind.lower() + 'Id': parts[1]} if len(parts) > 1 else {}}
        method = job.get('method', 'GET')
        if method == 'GET':
            action = ('get_management' if management else 'get_published') if len(parts) > 1 else ('list_management' if management else 'list_published')
        elif method == 'DELETE':
            action = 'archive'
        elif len(parts) == 1:
            action = 'create_draft'
        else:
            action = {'draft': 'save_draft', 'publish': 'publish', 'restore': 'restore'}[parts[2]]
        result = getattr(service, action)(request, {'sub': 'local-ui-editor', 'groups': ('admin',)})
        if action.startswith('list_'):
            body = {'data': result.items, 'meta': {'nextCursor': result.next_cursor}}
        else:
            body = {'data': result}
        reply = {'id': job['id'], 'status': 200, 'body': body}
    except ApiError as exc:
        reply = {'id': job['id'], 'status': exc.status, 'body': {'error': {'code': exc.code, 'message': exc.message}}}
    except Exception as exc:
        reply = {'id': job['id'], 'status': 500, 'body': {'error': {'code': 'LOCAL_PROBE_ERROR', 'message': str(exc)}}}
    print(json.dumps(reply, ensure_ascii=False), flush=True)
