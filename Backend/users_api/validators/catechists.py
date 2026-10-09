"""Strict directory validation; errors never echo input values."""
import re
from shared.errors import ApiError


def invalid(field):
    raise ApiError(400, 'VALIDATION_ERROR', 'Invalid request field.', [{'field': field}])


def fields(payload, allowed):
    if not isinstance(payload, dict) or set(payload) - set(allowed):
        invalid('body')


def text(payload, key, maximum, required=True):
    value = payload.get(key, '')
    if not isinstance(value, str) or len(value) > maximum or (required and not value.strip()):
        invalid(key)
    return value.strip()


def email(payload):
    value = text(payload, 'email', 254).lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
        invalid('email')
    return value


def version(payload):
    value = payload.get('version')
    if type(value) is not int or value < 1:
        invalid('version')
    return value


def validate_payload(payload, updating=False):
    fields(payload, {'name', 'email', 'phone', 'group', 'status'} | ({'version'} if updating else set()))
    result = {'name': text(payload, 'name', 200), 'email': email(payload),
              'phone': text(payload, 'phone', 32, False), 'group': text(payload, 'group', 100, False),
              'status': payload.get('status', 'ACTIVE')}
    if result['phone'] and not re.fullmatch(r'\+?[0-9 ()\-]{7,32}', result['phone']):
        invalid('phone')
    if result['status'] not in ('ACTIVE', 'PAUSED', 'INACTIVE'):
        invalid('status')
    if updating:
        result['version'] = version(payload)
    return result
