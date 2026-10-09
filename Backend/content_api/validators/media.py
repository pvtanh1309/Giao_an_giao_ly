from shared.validation import fields, integer
from .common import invalid

MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024


def validate_payload(body):
    fields(body, {"mimeType", "sizeBytes"}, ("mimeType", "sizeBytes"))
    if not isinstance(body["mimeType"], str) or body["mimeType"] not in MIME_TYPES:
        invalid("mimeType", "Only JPEG, PNG and WebP images are supported.")
    return {"mimeType": body["mimeType"], "sizeBytes": integer(body["sizeBytes"], "sizeBytes", minimum=1, maximum=MAX_BYTES)}
