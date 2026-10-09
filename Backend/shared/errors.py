"""Public API failures; unexpected exceptions are never serialized."""


class ApiError(Exception):
    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status = status
        self.status_code = status
        self.code = code
        self.message = message
        self.details = details or []
