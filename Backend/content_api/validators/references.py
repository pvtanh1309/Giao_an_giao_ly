from .common import content_payload


def validate_payload(body, updating=False):
    return content_payload(body, "REFERENCE", updating)
