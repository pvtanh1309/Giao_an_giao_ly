"""Passwords remain confined to request memory."""
from users_api.validators.catechists import fields, text, email, invalid


def password(payload):
    value = payload.get('password')
    if not isinstance(value, str) or not 8 <= len(value) <= 256 or value != value.strip():
        invalid('password')
    return value


def validate_payload(payload):
    fields(payload, {'email', 'password', 'role', 'catechistId'})
    result = {'email': email(payload), 'password': password(payload), 'role': payload.get('role')}
    if result['role'] not in ('EDITOR', 'READER'):
        invalid('role')
    if result['role'] == 'EDITOR':
        result['catechistId'] = text(payload, 'catechistId', 100)
    elif 'catechistId' in payload:
        invalid('catechistId')
    return result
