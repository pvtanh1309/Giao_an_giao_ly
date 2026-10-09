"""Revision lifecycle; META is the concurrency guard for every content mutation."""
from copy import deepcopy
from shared.errors import ApiError
from shared.models import now, epoch, new_id, normalize, paginate, public
from shared.validation import fields, version
from content_api.repositories.dynamodb import get_store
from content_api.validators.common import content_payload, invalid

RETENTION = 10 * 86400


def not_found():
    raise ApiError(404, "NOT_FOUND", "Content not found.")


def check_version(meta, value):
    if meta["version"] != value:
        raise ApiError(409, "VERSION_CONFLICT", "Content was updated by another editor.", {"version": meta["version"]})


class Content:
    def __init__(self, kind, store=None):
        self.kind = kind
        self.id_field = kind.lower() + "Id"
        self.store = store or get_store()

    def load(self, request, deleted=False):
        identifier = request["path_parameters"].get(self.id_field)
        if not isinstance(identifier, str) or not identifier:
            not_found()
        pk = self.kind + "#" + identifier
        items = {item["SK"]: item for item in self.store.transact_get([
            {"PK": pk, "SK": key} for key in ("META", "DRAFT", "PUBLISHED")])}
        meta = items.get("META")
        if not meta or (meta.get("purgeAt", epoch() + 1) <= epoch()) or (not deleted and meta.get("status") == "DELETED"):
            not_found()
        return items

    def index(self, meta):
        category = "#" + meta["category"] if self.kind == "REFERENCE" else ""
        meta["GSI1PK"] = "CATALOG#" + self.kind + category
        meta["GSI1SK"] = normalize(meta["title"]) + "#" + meta[self.id_field]
        meta["normalizedTitle"] = normalize(meta["title"])
        return meta

    def commit(self, writes):
        try:
            self.store.transact(writes)
        except ApiError as error:
            if error.code != "VERSION_CONFLICT":
                raise
            meta_write = next((write["put"] for write in writes if write.get("put", {}).get("SK") == "META"), None)
            current = self.store.get(meta_write["PK"], "META") if meta_write else None
            if current:
                raise ApiError(409, "VERSION_CONFLICT", "Content was updated by another editor.", {"version": current["version"]}) from None
            raise

    def metadata(self, revision):
        names = {self.id_field, "title", "summary", "description", "level", "sublevel", "lessonNumber", "durationMinutes", "category", "version", "createdAt", "createdBy", "updatedAt", "updatedBy", "publishedAt", "publishedBy"}
        return {key: value for key, value in revision.items() if key in names}

    def detail(self, items, management=False):
        revision = items.get("DRAFT") if management else None
        revision = revision or items.get("PUBLISHED")
        if revision is None:
            not_found()
        result = public(deepcopy(revision))
        if management:
            result.update(version=items["META"]["version"], hasDraft="DRAFT" in items, hasPublished="PUBLISHED" in items)
        if self.kind == "LESSON":
            from .media import hydrate
            result = hydrate(self.store, result, items["META"][self.id_field])
        return result

    def get_published(self, request, principal):
        return self.detail(self.load(request))

    def get_management(self, request, principal):
        return self.detail(self.load(request), True)

    def listing(self, request, management=False):
        query = request.get("query", {})
        allowed = {"q", "cursor", "limit", "category", "includeDeleted"} if self.kind == "REFERENCE" else {"q", "cursor", "limit", "level", "sublevel"} | ({"lessonNumber"} if self.kind == "LESSON" else set())
        if management:
            allowed.add("includeDeleted")
        if set(query) - allowed:
            invalid("query")
        if "includeDeleted" in query and (not management or query["includeDeleted"] not in ("true", "false")):
            invalid("includeDeleted")
        if query.get("category") not in (None, "Sinh hoạt", "Kỹ năng"):
            invalid("category")
        if query.get("lessonNumber") and (not query["lessonNumber"].isdigit() or int(query["lessonNumber"]) < 1):
            invalid("lessonNumber")
        partitions = ["CATALOG#" + self.kind]
        if self.kind == "REFERENCE":
            # A draft may change category while PUBLISHED remains in its old category.
            partitions = ["CATALOG#REFERENCE#Sinh hoạt", "CATALOG#REFERENCE#Kỹ năng"]
        rows, seen = [], set()
        for partition in partitions:
            for candidate in self.store.query_index(partition):
                pk = candidate["PK"]
                if pk in seen:
                    continue
                seen.add(pk)
                # Never trust eventually consistent GSI status or draft metadata.
                items = {x["SK"]: x for x in self.store.transact_get([
                    {"PK": pk, "SK": key} for key in ("META", "DRAFT", "PUBLISHED")])}
                meta = items.get("META")
                if not meta or meta.get("purgeAt", epoch() + 1) <= epoch():
                    continue
                if meta.get("status") == "DELETED" and not (management and query.get("includeDeleted") == "true"):
                    continue
                revision = (items.get("DRAFT") or items.get("PUBLISHED")) if management else items.get("PUBLISHED")
                if not revision:
                    continue
                row = self.metadata(revision)
                if management:
                    row.update(version=meta["version"], status=meta["status"], hasDraft="DRAFT" in items, hasPublished="PUBLISHED" in items)
                if any(str(row.get(key, "")) != str(query[key]) for key in ("level", "sublevel", "category", "lessonNumber") if key in query):
                    continue
                if normalize(query.get("q", "")) not in normalize(row["title"]):
                    continue
                rows.append(row)
        rows.sort(key=lambda item: (normalize(item["title"]), item[self.id_field]))
        return paginate(rows, query, {"kind": self.kind, "management": management, **{k: v for k, v in query.items() if k not in ("cursor", "limit")}})

    def list_published(self, request, principal):
        return self.listing(request)

    def list_management(self, request, principal):
        return self.listing(request, True)

    def create_draft(self, request, principal):
        payload = content_payload(request["body"], self.kind)
        identifier = new_id(self.kind.lower())
        timestamp = now()
        revision = dict(payload, PK=self.kind + "#" + identifier, SK="DRAFT", entityType=self.kind, version=1, createdAt=timestamp, createdBy=principal["sub"], updatedAt=timestamp, updatedBy=principal["sub"])
        revision[self.id_field] = identifier
        meta = self.index(dict(self.metadata(revision), PK=revision["PK"], SK="META", entityType=self.kind, status="ACTIVE", hasDraft=True, hasPublished=False))
        writes = [{"put": meta, "create": True}, {"put": revision, "create": True}]
        if self.kind == "LESSON":
            from shared.tiptap_validator import media_ids
            if media_ids(payload):
                invalid("mediaId", "Create the lesson before uploading images.")
        self.commit(writes)
        return public(revision)

    def save_draft(self, request, principal):
        payload = content_payload(request["body"], self.kind, True)
        items = self.load(request)
        old = items["META"]
        check_version(old, version(request["body"]))
        revision = dict(payload, PK=old["PK"], SK="DRAFT", entityType=self.kind, version=old["version"] + 1, createdAt=old["createdAt"], createdBy=old["createdBy"], updatedAt=now(), updatedBy=principal["sub"])
        revision[self.id_field] = old[self.id_field]
        meta = self.index(dict(old, **self.metadata(revision), hasDraft=True))
        writes = [{"put": meta, "version": old["version"]}, {"put": revision}]
        if self.kind == "LESSON":
            from .media import reconcile
            writes.extend(reconcile(self.store, old, revision, items.get("PUBLISHED")))
        self.commit(writes)
        return public(revision)

    def publish(self, request, principal):
        fields(request["body"], {"version"}, ("version",))
        items = self.load(request)
        old = items["META"]
        check_version(old, version(request["body"]))
        if "DRAFT" not in items:
            raise ApiError(409, "VERSION_CONFLICT", "There is no draft to publish.", {"version": old["version"]})
        revision = dict(items["DRAFT"], SK="PUBLISHED", version=old["version"] + 1, publishedAt=now(), publishedBy=principal["sub"])
        meta = self.index(dict(old, **self.metadata(revision), hasDraft=False, hasPublished=True))
        writes = [{"put": meta, "version": old["version"]}, {"put": revision}, {"delete": {"PK": old["PK"], "SK": "DRAFT"}}]
        if self.kind == "LESSON":
            from .media import reconcile
            writes.extend(reconcile(self.store, old, None, revision))
        self.commit(writes)
        return public(revision)

    def change_archive(self, request, principal, restoring=False):
        fields(request.get("body", {}), set())
        items = self.load(request, deleted=True)
        old = items["META"]
        if (old.get("status") != "DELETED") == restoring:
            return public(old)
        meta = dict(old, version=old["version"] + 1, updatedAt=now(), updatedBy=principal["sub"], status="ACTIVE" if restoring else "DELETED")
        if restoring:
            meta.pop("deletedAt", None)
            meta.pop("purgeAt", None)
            self.index(meta)
        else:
            meta.update(deletedAt=now(), purgeAt=epoch() + RETENTION)
            # Keep only metadata indexed so authenticated editors can discover trash.
            # Public listings always recheck ACTIVE status using an atomic snapshot.
        writes = [{"put": meta, "version": old["version"]}]
        for name in ("DRAFT", "PUBLISHED"):
            if name in items:
                revision = dict(items[name])
                if restoring:
                    revision.pop("purgeAt", None)
                else:
                    revision["purgeAt"] = meta["purgeAt"]
                writes.append({"put": revision})
        if self.kind == "LESSON":
            from .media import reconcile
            writes.extend(reconcile(self.store, old, items.get("DRAFT"), items.get("PUBLISHED"), archive_until=None if restoring else meta["purgeAt"]))
        self.commit(writes)
        return public(meta)

    def archive(self, request, principal):
        return self.change_archive(request, principal)

    def restore(self, request, principal):
        return self.change_archive(request, principal, True)
