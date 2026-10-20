"""Verify the domain-specific Lambda artifact boundary and release manifest."""
import hashlib
import json
from pathlib import Path
import zipfile


def test_package_artifacts_and_manifest_match_release(tmp_path, monkeypatch):
    repo_root = Path(__file__).parents[2]
    backend_root = repo_root / "Backend"
    monkeypatch.syspath_prepend(str(backend_root / "scripts"))
    monkeypatch.syspath_prepend(str(repo_root / "scripts" / "ci"))

    import create_release_manifest
    import package_lambdas

    package_lambdas.build_source_archives(tmp_path, backend_root)

    expected_names = {"lessons-api.zip", "catalog-api.zip", "users-api.zip"}
    assert {path.name for path in tmp_path.glob("*.zip")} == expected_names

    expected_members = {
        "lessons-api.zip": {
            "lessons_api/handler.py",
            "content_api/services/lessons.py",
            "content_api/services/lesson_notes.py",
            "content_api/services/media.py",
        },
        "catalog-api.zip": {
            "catalog_api/handler.py",
            "content_api/services/programs.py",
            "content_api/services/references.py",
        },
        "users-api.zip": {"users_api/handler.py"},
    }
    forbidden_members = {
        "lessons-api.zip": {"catalog_api/handler.py", "content_api/services/programs.py"},
        "catalog-api.zip": {"lessons_api/handler.py", "content_api/services/lessons.py", "content_api/services/media.py"},
        "users-api.zip": {"lessons_api/handler.py", "catalog_api/handler.py"},
    }
    for filename, required in expected_members.items():
        with zipfile.ZipFile(tmp_path / filename) as archive:
            members = set(archive.namelist())
        assert required <= members
        assert members.isdisjoint(forbidden_members[filename])

    manifest = create_release_manifest.create_manifest(tmp_path, "release-sha")
    assert manifest["sourceSha"] == "release-sha"
    assert set(manifest["artifacts"]) == expected_names
    for filename in expected_names:
        digest = hashlib.sha256((tmp_path / filename).read_bytes()).hexdigest()
        assert manifest["artifacts"][filename]["sha256"] == digest
    assert json.loads((tmp_path / "release-manifest.json").read_text(encoding="utf-8")) == manifest
