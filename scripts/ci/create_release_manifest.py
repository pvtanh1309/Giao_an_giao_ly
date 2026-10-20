import hashlib
import json
import os
from pathlib import Path

ARTIFACT_NAMES = ("lessons-api.zip", "catalog-api.zip", "users-api.zip")


def create_manifest(dist_dir, source_sha):
    dist = Path(dist_dir)
    manifest = {
        "schemaVersion": 1,
        "sourceSha": source_sha,
        "artifacts": {},
    }
    for filename in ARTIFACT_NAMES:
        path = dist / filename
        manifest["artifacts"][filename] = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }

    (dist / "release-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def main():
    create_manifest(Path("Backend/dist"), os.environ["SOURCE_SHA"])


if __name__ == "__main__":
    main()
