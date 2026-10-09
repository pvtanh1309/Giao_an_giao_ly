"""Content persistence uses the shared conditional DynamoDB adapter."""
from shared.db import Store


def get_store():
    return Store()
