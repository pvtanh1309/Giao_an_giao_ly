"""Atomic attachment/orphan bookkeeping; media ownership never comes from a URL."""
from copy import deepcopy
from botocore.exceptions import ClientError
from shared.errors import ApiError
from shared.models import epoch
from shared.tiptap_validator import media_ids
from content_api.repositories.s3_media import MediaObjects
from content_api.validators.common import invalid
from content_api.validators.media import MAX_BYTES, MIME_TYPES

RETENTION = 10 * 86400


def owned(store, media_id, lesson_id):
    item = store.get("MEDIA#" + media_id)
    if not item or item.get("lessonId") != lesson_id or item.get("purgeAt", epoch() + 1) <= epoch():
        invalid("mediaId", "Image does not belong to this lesson or has expired.")
    expected = "lesson-media/" + lesson_id + "/" + media_id
    if item.get("objectKey") != expected:
        invalid("mediaId", "Invalid image key.")
    return item


def validate_object(objects, item):
    try:
        head = objects.head(item)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound", "NoSuchVersion"):
            invalid("mediaId", "Upload has not completed.")
        raise
    if head.get("ContentType") not in MIME_TYPES or head.get("ContentType") != item["mimeType"] or head.get("ContentLength") != item["sizeBytes"] or not 0 < head.get("ContentLength", 0) <= MAX_BYTES:
        invalid("mediaId", "Uploaded image MIME type or size does not match.")
    version_id = head.get("VersionId")
    if not version_id or version_id == "null":
        raise ApiError(500, "INTERNAL_ERROR", "Private media storage requires bucket versioning.")
    return version_id


def reconcile(store, meta, draft, published, archive_until=None, objects=None):
    referenced = media_ids(draft or {}) | media_ids(published or {})
    if len(referenced) > 40:
        invalid("mediaId", "A lesson may reference at most 40 images across its draft and published revisions.")
    associations = {x["mediaId"]: x for x in store.query(meta["PK"]) if x["SK"].startswith("MEDIA#")}
    writes = []
    objects = objects or (MediaObjects() if referenced and archive_until is None else None)
    for media_id in sorted(referenced):
        item = owned(store, media_id, meta["lessonId"])
        updated = dict(item, version=item["version"] + 1, uploadStatus="ATTACHED")
        association = {"PK": meta["PK"], "SK": "MEDIA#" + media_id, "entityType": "MEDIA_LINK", "mediaId": media_id}
        if archive_until is None:
            updated["objectVersion"] = validate_object(objects, item)
            updated.pop("purgeAt", None)
        else:
            updated["purgeAt"] = archive_until
            association["purgeAt"] = archive_until
        writes.extend([{"put": updated, "version": item["version"]}, {"put": association}])
    for media_id in sorted(set(associations) - referenced):
        item = store.get("MEDIA#" + media_id)
        if item:
            updated = dict(item, purgeAt=epoch() + RETENTION, version=item["version"] + 1)
            writes.append({"put": updated, "version": item["version"]})
        writes.append({"delete": {"PK": meta["PK"], "SK": "MEDIA#" + media_id}})
    if len(writes) > 96:
        invalid("mediaId", "Too many image changes in one revision; remove or add images in separate saves.")
    return writes


def hydrate(store, revision, lesson_id, objects=None):
    ids = media_ids(revision)
    if not ids:
        return revision
    objects = objects or MediaObjects()
    urls = {}
    for media_id in ids:
        item = owned(store, media_id, lesson_id)
        if item.get("uploadStatus") != "ATTACHED" or not item.get("objectVersion"):
            invalid("mediaId", "Image is not attached.")
        urls[media_id] = objects.download_url(item)
    result = deepcopy(revision)
    def walk(value):
        if isinstance(value, dict):
            if value.get("type") == "image":
                value["attrs"]["src"] = urls[value["attrs"]["mediaId"]]
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(result)
    return result
