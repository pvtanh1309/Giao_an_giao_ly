"""Build reproducible Lambda ZIPs, excluding tests, secrets and local tooling.

Run from any directory: python Backend/scripts/package_lambdas.py
Dependencies are installed from requirements.txt into a temporary build directory.
"""
import hashlib
import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

BACKEND = Path(__file__).resolve().parents[1]


def build(offline=False):
    destination = BACKEND / "dist"
    destination.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="giaoan-lambda-") as temporary:
        staging = Path(temporary)
        uv = shutil.which("uv")
        if uv:
            command = [uv, "--cache-dir", str(BACKEND.parent / '.cache' / 'uv'), "pip", "install", "--python", sys.executable, "--target", str(staging),
                       "--no-compile-bytecode", "--only-binary", ":all:", "-r", str(BACKEND / "requirements.txt")]
        else:
            command = [sys.executable, "-m", "pip", "install", "--target", str(staging),
                       "--only-binary=:all:", "-r", str(BACKEND / "requirements.txt")]
        if offline:
            command.append("--offline" if uv else "--no-index")
        subprocess.run(command, check=True)
        dependencies = [p for p in staging.rglob("*") if p.is_file() and "__pycache__" not in p.parts
                        and p.suffix != ".pyc" and p.name not in {"RECORD", "INSTALLER", "direct_url.json"}]
        for name, package in (("content-api", "content_api"), ("users-api", "users_api")):
            output = destination / (name + ".zip")
            files = [(p, p.relative_to(staging).as_posix()) for p in dependencies]
            for folder in (package, "shared"):
                files.extend((p, p.relative_to(BACKEND).as_posix()) for p in (BACKEND / folder).rglob("*.py"))
            with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for source, relative in sorted(files, key=lambda pair: pair[1]):
                    info = zipfile.ZipInfo(relative, (2020, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    archive.writestr(info, source.read_bytes())
            digest = hashlib.sha256(output.read_bytes()).hexdigest()
            print(f"{output}: sha256={digest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline', action='store_true', help='Use cached dependencies only (uv recommended)')
    build(parser.parse_args().offline)
