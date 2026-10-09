"""Content contract and atomic lifecycle regression tests, with no AWS calls."""
from copy import deepcopy
import json
import pytest
from boto3.dynamodb.types import TypeSerializer
from shared.errors import ApiError
from content_api.services.content import Content
from content_api.services import media
from content_api.services.media_lifecycle import reconcile, hydrate
from content_api.validators.common import content_payload
from content_api.repositories.s3_media import MediaObjects

EDITOR = {"sub": "editor-id", "groups": ("editor",)}
DOC = {"type": "doc", "content": [{"type": "paragraph"}]}


class MemoryStore:
    def __init__(self):
        self.items = {}
        self.batches = []

    def get(self, pk, sk="PROFILE"):
        return deepcopy(self.items.get((pk, sk)))

    def transact_get(self, keys):
        return [deepcopy(self.items[(key['PK'], key['SK'])]) for key in keys
                if (key['PK'], key['SK']) in self.items]

    def query(self, pk):
        return [deepcopy(item) for (key, _), item in self.items.items() if key == pk]

    def query_index(self, partition):
        return [deepcopy(item) for item in self.items.values() if item.get("GSI1PK") == partition]

    def transact(self, writes):
        assert len(writes) <= 100
        assert len({(next(w[k] for k in ("put", "delete", "check") if k in w)["PK"], next(w[k] for k in ("put", "delete", "check") if k in w)["SK"]) for w in writes}) == len(writes)
        for write in writes:
            item = next(write[key] for key in ("put", "delete", "check") if key in write)
            current = self.items.get((item["PK"], item["SK"]))
            if (write.get("create") and current) or ("version" in write and (not current or current.get("version") != write["version"])):
                raise ApiError(409, "VERSION_CONFLICT", "Conflict")
        for write in writes:
            if "put" in write:
                item = write["put"]
                self.items[item["PK"], item["SK"]] = deepcopy(item)
            if "delete" in write:
                self.items.pop((write["delete"]["PK"], write["delete"]["SK"]), None)
        self.batches.append(deepcopy(writes))


def request(body=None, kind="LESSON", identifier=None, query=None):
    return {"body": body or {}, "path_parameters": {kind.lower() + "Id": identifier} if identifier else {}, "query": query or {}, "request_id": "req-test"}


def payload(kind):
    if kind == "LESSON":
        return {"title": "Bài học", "level": "Ấu Nhi", "sublevel": "Ấu 1", "lessonNumber": 1, "durationMinutes": 45}
    if kind == "REFERENCE":
        return {"title": "Trò chơi", "category": "Sinh hoạt", "content": deepcopy(DOC)}
    return {"title": "Chương trình", "level": "Ấu Nhi", "sublevel": "Ấu 1", "scheduleColumns": [{"id": "date", "label": "Ngày"}, {"id": "content", "label": "Nội dung"}], "schedule": [{"id": "row1", "values": {"date": deepcopy(DOC), "content": deepcopy(DOC)}, "mergedCellGroups": [["date", "content"]]}]}


@pytest.mark.parametrize("kind", ["LESSON", "PROGRAM", "REFERENCE"])
def test_revision_visibility_version_and_atomic_publish(kind):
    store = MemoryStore()
    service = Content(kind, store)
    created = service.create_draft(request(payload(kind)), EDITOR)
    identifier = created[kind.lower() + "Id"]
    req = request(kind=kind, identifier=identifier)
    assert service.list_published(request(), EDITOR).items == []
    with pytest.raises(ApiError) as error:
        service.get_published(req, EDITOR)
    assert error.value.status == 404
    req["body"] = {"version": 1}
    published = service.publish(req, EDITOR)
    assert published["version"] == 2
    assert store.get(kind + "#" + identifier, "DRAFT") is None
    assert len(store.batches[-1]) == 3
    req["body"] = dict(payload(kind), title="Secret draft", version=2)
    if kind == "REFERENCE":
        req["body"]["category"] = "Kỹ năng"
    draft = service.save_draft(req, EDITOR)
    assert draft["version"] == 3
    assert service.get_published(req, EDITOR)["title"] == payload(kind)["title"]
    assert service.get_management(req, EDITOR)["title"] == "Secret draft"
    assert service.list_published(request(query={"q": "Secret"}), EDITOR).items == []
    if kind == "REFERENCE":
        assert len(service.list_published(request(query={"category": "Sinh hoạt"}), EDITOR).items) == 1
        assert service.list_published(request(query={"category": "Kỹ năng"}), EDITOR).items == []
    with pytest.raises(ApiError) as error:
        service.save_draft(req, EDITOR)
    assert error.value.code == "VERSION_CONFLICT"
    assert error.value.details["version"] == 3


@pytest.mark.parametrize('kind', ['LESSON', 'PROGRAM'])
def test_draft_and_trash_discoverable_after_reload(kind):
    store = MemoryStore()
    service = Content(kind, store)
    created = service.create_draft(request(payload(kind)), EDITOR)
    assert service.list_management(request(), EDITOR).items[0][kind.lower() + 'Id'] == created[kind.lower() + 'Id']
    req = request(kind=kind, identifier=created[kind.lower() + 'Id'])
    service.archive(req, EDITOR)
    assert service.list_management(request(), EDITOR).items == []
    trash = service.list_management(request(query={'includeDeleted': 'true'}), EDITOR).items
    assert trash[0]['status'] == 'DELETED'
    assert service.list_published(request(), EDITOR).items == []
    service.restore(req, EDITOR)
    assert service.get_management(req, EDITOR)['title'] == created['title']


@pytest.mark.parametrize("kind", ["LESSON", "PROGRAM", "REFERENCE"])
def test_archive_restore_retention(kind, monkeypatch):
    store = MemoryStore()
    service = Content(kind, store)
    created = service.create_draft(request(payload(kind)), EDITOR)
    req = request(kind=kind, identifier=created[kind.lower() + "Id"])
    archived = service.archive(req, EDITOR)
    assert archived["status"] == "DELETED"
    assert all("purgeAt" in item for item in store.query(kind + "#" + created[kind.lower() + "Id"]))
    with pytest.raises(ApiError):
        service.get_management(req, EDITOR)
    if kind == "REFERENCE":
        assert len(service.list_management(request(query={"includeDeleted": "true"}), EDITOR).items) == 1
    restored = service.restore(req, EDITOR)
    assert restored["status"] == "ACTIVE"
    assert all("purgeAt" not in item for item in store.query(kind + "#" + created[kind.lower() + "Id"]))
    archived = service.archive(req, EDITOR)
    monkeypatch.setattr("content_api.services.content.epoch", lambda: archived["purgeAt"])
    with pytest.raises(ApiError) as error:
        service.restore(req, EDITOR)
    assert error.value.status == 404


def test_program_merge_validation_and_retained_cells():
    data = payload("PROGRAM")
    assert content_payload(data, "PROGRAM")["schedule"][0]["values"] == data["schedule"][0]["values"]
    data["schedule"][0]["mergedCellGroups"] = [["content", "date"]]
    with pytest.raises(ApiError):
        content_payload(data, "PROGRAM")
    data = payload("PROGRAM")
    del data["schedule"][0]["values"]["content"]
    with pytest.raises(ApiError):
        content_payload(data, "PROGRAM")


@pytest.mark.parametrize("kind", ["LESSON", "PROGRAM", "REFERENCE"])
def test_unknown_client_fields_rejected(kind):
    with pytest.raises(ApiError):
        content_payload(dict(payload(kind), createdBy="attacker"), kind)


def image_doc(identifier="media_one"):
    return {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "image", "attrs": {"mediaId": identifier, "alt": "An image", "width": 220, "alignment": "center"}}]}]}


def media_item(identifier="media_one", lesson_id="lesson_one"):
    return {"PK": "MEDIA#" + identifier, "SK": "PROFILE", "entityType": "MEDIA", "mediaId": identifier, "lessonId": lesson_id, "objectKey": "lesson-media/" + lesson_id + "/" + identifier, "mimeType": "image/png", "sizeBytes": 100, "version": 1, "uploadStatus": "UPLOADING"}


class Objects:
    def __init__(self):
        self.head_result = {"ContentType": "image/png", "ContentLength": 100, "VersionId": "version-original"}
        self.deleted = []
        self.downloaded = []

    def head(self, item):
        return self.head_result

    def download_url(self, item):
        self.downloaded.append(item)
        return "https://private/image?versionId=" + item["objectVersion"]

    def upload_url(self, item):
        return "https://private/upload"

    def delete_all(self, item):
        self.deleted.append(item)


def test_media_ownership_validation_pinning_and_orphan_retention():
    store, objects = MemoryStore(), Objects()
    item = media_item()
    store.transact([{"put": item}])
    meta = {"PK": "LESSON#lesson_one", "lessonId": "lesson_one"}
    draft = {"keyPoints": image_doc()}
    store.transact(reconcile(store, meta, draft, None, objects=objects))
    attached = store.get(item["PK"])
    assert attached["objectVersion"] == "version-original"
    assert "purgeAt" not in attached
    hydrated = hydrate(store, draft, "lesson_one", objects)
    assert hydrated["keyPoints"]["content"][0]["content"][0]["attrs"]["src"].endswith("version-original")
    assert "src" not in draft["keyPoints"]["content"][0]["content"][0]["attrs"]
    with pytest.raises(ApiError):
        hydrate(store, draft, "lesson_other", objects)
    store.transact(reconcile(store, meta, None, draft, objects=objects))
    assert "purgeAt" not in store.get(item["PK"])
    store.transact(reconcile(store, meta, None, None, objects=objects))
    assert store.get(item["PK"])["purgeAt"] > media.epoch()
    assert store.query(meta["PK"]) == []


@pytest.mark.parametrize("head", [{"ContentType": "image/svg+xml", "ContentLength": 100, "VersionId": "v1"}, {"ContentType": "image/png", "ContentLength": 101, "VersionId": "v1"}, {"ContentType": "image/png", "ContentLength": 100, "VersionId": "null"}])
def test_media_rejects_mismatched_or_unversioned_objects(head):
    store, objects = MemoryStore(), Objects()
    store.transact([{"put": media_item()}])
    objects.head_result = head
    with pytest.raises(ApiError):
        reconcile(store, {"PK": "LESSON#lesson_one", "lessonId": "lesson_one"}, {"keyPoints": image_doc()}, None, objects=objects)
    assert store.get("MEDIA#media_one")["uploadStatus"] == "UPLOADING"


def test_upload_validates_existing_lesson_and_expiry(monkeypatch):
    store, objects = MemoryStore(), Objects()
    created = Content("LESSON", store).create_draft(request(payload("LESSON")), EDITOR)
    monkeypatch.setattr(media, "get_store", lambda: store)
    monkeypatch.setattr(media, "MediaObjects", lambda: objects)
    req = request({"mimeType": "image/png", "sizeBytes": 100}, identifier=created["lessonId"])
    result = media.issue_upload_url(req, EDITOR)
    assert result["expiresInSeconds"] == 300
    assert result["requiredHeaders"] == {"Content-Type": "image/png"}
    assert store.get("MEDIA#" + result["mediaId"])["purgeAt"] > media.epoch()
    req["body"]["mimeType"] = "image/svg+xml"
    with pytest.raises(ApiError):
        media.issue_upload_url(req, EDITOR)


def stream_record(item, sequence="123"):
    serializer = TypeSerializer()
    return {"eventName": "REMOVE", "eventID": "event", "dynamodb": {"SequenceNumber": sequence, "OldImage": {key: serializer.serialize(value) for key, value in item.items()}}}


def test_stream_ignores_restored_future_and_other_items_retries_failures(monkeypatch):
    store, objects = MemoryStore(), Objects()
    monkeypatch.setattr(media, "get_store", lambda: store)
    monkeypatch.setattr(media, "MediaObjects", lambda: objects)
    expired = dict(media_item(), purgeAt=media.epoch() - 1)
    future = dict(expired, purgeAt=media.epoch() + 100)
    event = {"Records": [stream_record(future), stream_record(dict(expired, entityType="ACCOUNT")), stream_record(expired)]}
    assert media.handle_stream(event, None) == {"batchItemFailures": []}
    assert len(objects.deleted) == 1
    store.transact([{"put": media_item()}])
    media.handle_stream({"Records": [stream_record(expired)]}, None)
    assert len(objects.deleted) == 1
    store.items.clear()
    def fail(item):
        raise RuntimeError("temporary S3 failure")
    objects.delete_all = fail
    assert media.handle_stream({"Records": [stream_record(expired)]}, None) == {"batchItemFailures": [{"itemIdentifier": "123"}]}


def test_s3_presign_versions_and_exact_key_cleanup():
    class Client:
        def __init__(self):
            self.calls, self.deleted = [], []
        def generate_presigned_url(self, operation, **kwargs):
            self.calls.append((operation, kwargs))
            return "signed"
        def get_paginator(self, name):
            return self
        def paginate(self, **kwargs):
            key = kwargs["Prefix"]
            return [{"Versions": [{"Key": key, "VersionId": "v1"}, {"Key": key + "-another", "VersionId": "v2"}], "DeleteMarkers": [{"Key": key, "VersionId": "marker"}]}]
        def delete_object(self, **kwargs):
            self.deleted.append(kwargs)
    client = Client()
    objects = MediaObjects(client, "private-bucket")
    item = dict(media_item(), objectVersion="v1")
    objects.upload_url(item)
    objects.download_url(item)
    assert client.calls[0][1]["ExpiresIn"] == 300
    assert client.calls[1][1]["ExpiresIn"] == 900
    assert client.calls[1][1]["Params"]["VersionId"] == "v1"
    objects.delete_all(item)
    assert [item["VersionId"] for item in client.deleted] == ["v1", "marker"]


def test_http_authorization_and_real_dispatch(monkeypatch):
    from content_api.handler import lambda_handler
    import content_api.services.content as content
    store = MemoryStore()
    store.items['ACCOUNT#reader', 'PROFILE'] = {'accountStatus': 'ACTIVE', 'role': 'EDITOR'}
    monkeypatch.setattr('shared.db.Store', lambda: store)
    monkeypatch.setattr(content, "get_store", lambda: store)
    event = {"version": "2.0", "routeKey": "POST /manage/lessons", "body": json.dumps(payload("LESSON")), "requestContext": {"requestId": "r1", "authorizer": {"jwt": {"claims": {"sub": "reader", "token_use": "access", "cognito:groups": "reader"}}}}}
    assert lambda_handler(event, None)["statusCode"] == 403
    event["requestContext"]["authorizer"]["jwt"]["claims"]["cognito:groups"] = "editor"
    response = lambda_handler(event, None)
    assert response["statusCode"] == 201
    body = json.loads(response["body"])
    assert body["meta"]["requestId"] == "r1"
    assert body["data"]["lessonId"].startswith("lesson_")


def test_lesson_image_save_publish_archive_restore_and_public_reference_union(monkeypatch):
    import content_api.services.media_lifecycle as lifecycle
    store, objects = MemoryStore(), Objects()
    monkeypatch.setattr(lifecycle, "MediaObjects", lambda: objects)
    service = Content("LESSON", store)
    created = service.create_draft(request(payload("LESSON")), EDITOR)
    identifier = created["lessonId"]
    store.transact([{"put": media_item(lesson_id=identifier)}])
    req = request(dict(payload("LESSON"), keyPoints=image_doc(), version=1), identifier=identifier)
    saved = service.save_draft(req, EDITOR)
    assert saved["version"] == 2
    req["body"] = {"version": 2}
    service.publish(req, EDITOR)
    req["body"] = dict(payload("LESSON"), version=3)
    service.save_draft(req, EDITOR)
    assert "purgeAt" not in store.get("MEDIA#media_one")
    assert "src" in service.get_published(req, EDITOR)["keyPoints"]["content"][0]["content"][0]["attrs"]
    assert service.get_management(req, EDITOR)["keyPoints"]["content"] == []
    req["body"] = {}
    service.archive(req, EDITOR)
    assert "purgeAt" in store.get("MEDIA#media_one")
    service.restore(req, EDITOR)
    assert "purgeAt" not in store.get("MEDIA#media_one")
    req["body"] = {"version": 6}
    service.publish(req, EDITOR)
    assert "purgeAt" in store.get("MEDIA#media_one")


def test_failed_publish_transaction_keeps_draft(monkeypatch):
    store = MemoryStore()
    service = Content("REFERENCE", store)
    created = service.create_draft(request(payload("REFERENCE")), EDITOR)
    before = deepcopy(store.items)
    def fail(writes):
        raise ApiError(409, "VERSION_CONFLICT", "Concurrent mutation")
    monkeypatch.setattr(store, "transact", fail)
    with pytest.raises(ApiError):
        service.publish(request({"version": 1}, kind="REFERENCE", identifier=created["referenceId"]), EDITOR)
    assert store.items == before


def test_racing_write_returns_current_metadata_version(monkeypatch):
    store = MemoryStore()
    service = Content("REFERENCE", store)
    created = service.create_draft(request(payload("REFERENCE")), EDITOR)
    def race(writes):
        store.items[("REFERENCE#" + created["referenceId"], "META")]["version"] = 2
        raise ApiError(409, "VERSION_CONFLICT", "Concurrent mutation")
    monkeypatch.setattr(store, "transact", race)
    with pytest.raises(ApiError) as error:
        service.publish(request({"version": 1}, kind="REFERENCE", identifier=created["referenceId"]), EDITOR)
    assert error.value.details == {"version": 2}
    assert store.get("REFERENCE#" + created["referenceId"], "DRAFT") is not None


def test_inline_src_and_images_outside_lessons_rejected():
    data = payload("LESSON")
    data["keyPoints"] = image_doc()
    data["keyPoints"]["content"][0]["content"][0]["attrs"]["src"] = "https://untrusted/image"
    with pytest.raises(ApiError):
        content_payload(data, "LESSON")
    with pytest.raises(ApiError):
        content_payload(dict(payload("REFERENCE"), content=image_doc()), "REFERENCE")


def test_aggregate_richtext_limit():
    data = payload("LESSON")
    doc = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "a" * 110000}]}]}
    data.update(keyPoints=doc, sentiment=doc)
    with pytest.raises(ApiError) as error:
        content_payload(data, "LESSON")
    assert error.value.status == 413
