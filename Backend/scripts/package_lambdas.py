"""Build reproducible, domain-specific Lambda ZIPs.

Run from any directory: python Backend/scripts/package_lambdas.py
Dependencies are installed from requirements.txt into a temporary build directory.
"""
import argparse
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

BACKEND = Path(__file__).resolve().parents[1]

SOURCE_PATHS = {
    "lessons-api": (
        "lessons_api",
        "shared",
        "content_api/__init__.py",
        "content_api/routes.py",
        "content_api/services/__init__.py",
        "content_api/services/content.py",
        "content_api/services/lessons.py",
        "content_api/services/lesson_notes.py",
        "content_api/services/note_anchors.py",
        "content_api/services/media.py",
        "content_api/services/media_lifecycle.py",
        "content_api/repositories/__init__.py",
        "content_api/repositories/dynamodb.py",
        "content_api/repositories/lesson_notes.py",
        "content_api/repositories/s3_media.py",
        "content_api/validators/__init__.py",
        "content_api/validators/common.py",
        "content_api/validators/lesson_notes.py",
        "content_api/validators/lessons.py",
        "content_api/validators/media.py",
    ),
    "catalog-api": (
        "catalog_api",
        "shared",
        "content_api/__init__.py",
        "content_api/routes.py",
        "content_api/services/__init__.py",
        "content_api/services/content.py",
        "content_api/services/programs.py",
        "content_api/services/references.py",
        "content_api/repositories/__init__.py",
        "content_api/repositories/dynamodb.py",
        "content_api/validators/__init__.py",
        "content_api/validators/common.py",
        "content_api/validators/programs.py",
        "content_api/validators/references.py",
    ),
    "users-api": ("users_api", "shared"),
}


def source_files_for(package_name, backend_root=BACKEND):
    """Return the sorted source files explicitly assigned to one Lambda."""
    if package_name not in SOURCE_PATHS:
        raise ValueError(f"Unknown Lambda package: {package_name}")

    files = {}
    for relative in SOURCE_PATHS[package_name]:
        path = backend_root / relative
        if path.is_dir():
            candidates = (item for item in path.rglob("*.py") if item.is_file())
        elif path.is_file():
            candidates = (path,)
        else:
            raise FileNotFoundError(f"Missing package source: {path}")
        for source in candidates:
            files[source.relative_to(backend_root).as_posix()] = source
    return [(files[name], name) for name in sorted(files)]


def write_archive(output, source_files, dependency_files=(), dependency_root=None):
    """Write source and staged dependency files with stable ZIP metadata."""
    members = {relative: source for source, relative in source_files}
    for dependency in dependency_files:
        if dependency_root is None:
            raise ValueError("dependency_root is required when adding dependency files")
        relative = dependency.relative_to(dependency_root).as_posix()
        members[relative] = dependency

    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for relative, source in sorted(members.items()):
            info = zipfile.ZipInfo(relative, (2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, source.read_bytes())
    return output


def build_source_archives(destination, backend_root=BACKEND, dependency_files=(), dependency_root=None):
    """Build all Lambda ZIPs; dependency_files may be empty for offline tests."""
    destination = Path(destination)
    return [
        write_archive(
            destination / f"{name}.zip",
            source_files_for(name, backend_root),
            dependency_files,
            dependency_root,
        )
        for name in SOURCE_PATHS
    ]


def build(offline=False):
    destination = BACKEND / "dist"
    with tempfile.TemporaryDirectory(prefix="giaoan-lambda-") as temporary:
        staging = Path(temporary)
        uv = shutil.which("uv")
        if uv:
            command = [uv, "--cache-dir", str(BACKEND.parent / ".cache" / "uv"), "pip", "install", "--python", sys.executable, "--target", str(staging),
                       "--no-compile-bytecode", "--only-binary", ":all:", "-r", str(BACKEND / "requirements.txt")]
        else:
            command = [sys.executable, "-m", "pip", "install", "--target", str(staging),
                       "--only-binary=:all:", "-r", str(BACKEND / "requirements.txt")]
        if offline:
            command.append("--offline" if uv else "--no-index")
        subprocess.run(command, check=True)
        dependencies = [p for p in staging.rglob("*") if p.is_file() and "__pycache__" not in p.parts
                        and p.suffix != ".pyc" and p.name not in {"RECORD", "INSTALLER", "direct_url.json"}]
        archives = build_source_archives(destination, BACKEND, dependencies, staging)
        for output in archives:
            digest = hashlib.sha256(output.read_bytes()).hexdigest()
            print(f"{output}: sha256={digest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Use cached dependencies only (uv recommended)")
    build(parser.parse_args().offline)
