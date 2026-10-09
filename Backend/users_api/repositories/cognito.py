"""Lazy Cognito boundary; never log SDK arguments or exception messages."""
import os
from shared.errors import ApiError


class Cognito:
    def __init__(self, client=None, pool_id=None):
        self._client = client
        self.pool_id = pool_id or os.environ.get('USER_POOL_ID')

    def call(self, operation, **kwargs):
        if self._client is None:
            import boto3
            from botocore.config import Config
            self._client = boto3.client('cognito-idp', config=Config(
                connect_timeout=3, read_timeout=5, retries={'max_attempts': 2, 'mode': 'standard'}))
        try:
            return getattr(self._client, operation)(UserPoolId=self.pool_id, **kwargs)
        except Exception as exc:
            code = getattr(exc, 'response', {}).get('Error', {}).get('Code')
            if code in ('UsernameExistsException', 'AliasExistsException'):
                raise ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email already exists.') from None
            if code in ('InvalidPasswordException', 'InvalidParameterException'):
                raise ApiError(400, 'VALIDATION_ERROR', 'Cognito rejected the account input.') from None
            if code == 'UserNotFoundException' and operation == 'admin_delete_user':
                return {}
            raise

    def delete(self, username):
        return self.call('admin_delete_user', Username=username)
