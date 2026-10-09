"""Upload URL issuance and idempotent TTL stream cleanup."""
from boto3.dynamodb.types import TypeDeserializer
from shared.models import epoch, now, new_id
from content_api.repositories.dynamodb import get_store
from content_api.repositories.s3_media import MediaObjects
from content_api.validators.media import validate_payload
from .content import Content
from .media_lifecycle import reconcile, hydrate


def issue_upload_url(request, principal):
    payload = validate_payload(request["body"])
    store = get_store()
    meta = Content("LESSON", store).load(request)["META"]
    identifier = new_id("media")
    item = dict(payload, PK="MEDIA#" + identifier, SK="PROFILE", entityType="MEDIA",
                mediaId=identifier, lessonId=meta["lessonId"],
                objectKey="lesson-media/" + meta["lessonId"] + "/" + identifier,
                uploadStatus="UPLOADING", version=1, createdAt=now(),
                createdBy=principal["sub"], purgeAt=epoch() + 86400)
    objects = MediaObjects()
    url = objects.upload_url(item)
    store.transact([{"check": {"PK": meta["PK"], "SK": "META"}, "version": meta["version"]},
                    {"put": item, "create": True}])
    return {"mediaId": identifier, "uploadUrl": url, "requiredHeaders": {"Content-Type": payload["mimeType"]}, "expiresInSeconds": 300}


def handle_stream(event, context):
    failures = []
    deserializer = TypeDeserializer()
    store = None
    objects = None
    for record in event.get("Records", []):
        if record.get("eventName") != "REMOVE":
            continue
        image = record.get("dynamodb", {}).get("OldImage", {})
        try:
            item = {key: deserializer.deserialize(value) for key, value in image.items()}
            if item.get("entityType") != "MEDIA" or not item.get("purgeAt") or item["purgeAt"] > epoch():
                continue
            media_id, lesson_id = item.get("mediaId"), item.get("lessonId")
            if not isinstance(media_id, str) or not isinstance(lesson_id, str):
                continue
            if item.get("PK") != "MEDIA#" + media_id or item.get("SK") != "PROFILE" or item.get("objectKey") != "lesson-media/" + lesson_id + "/" + media_id:
                continue
            store = store or get_store()
            # A restored/recreated record takes precedence over an old stream event.
            if store.get(item["PK"], "PROFILE"):
                continue
            objects = objects or MediaObjects()
            objects.delete_all(item)
        except Exception:
            failures.append({"itemIdentifier": record.get("dynamodb", {}).get("SequenceNumber", record.get("eventID", ""))})
    return {"batchItemFailures": failures}
