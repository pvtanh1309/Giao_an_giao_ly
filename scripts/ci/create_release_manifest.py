"""Record the source SHA and checksums of the packaged Lambda ZIPs."""

import hashlib
import json
import os
from pathlib import Path


def main():
    dist = Path("Backend/dist")
    manifest = {
        "schemaVersion": 1,
        "sourceSha": os.environ["SOURCE_SHA"],
        "artifacts": {},
    }
    for filename in ("content-api.zip", "users-api.zip"):
        path = dist / filename
        manifest["artifacts"][filename] = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }

    (dist / "release-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
