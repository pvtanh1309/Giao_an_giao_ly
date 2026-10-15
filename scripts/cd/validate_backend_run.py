import json
import os
import re
from pathlib import Path


def main():
    runner_temp = Path(os.environ["RUNNER_TEMP"])
    github_output = Path(os.environ["GITHUB_OUTPUT"])
    gh_repo = os.environ["GH_REPO"]

    run_file = runner_temp / "backend-run.json"

    # Đọc thông tin GitHub Actions run
    run = json.loads(run_file.read_text())

    # Kiểm tra run có hợp lệ để deploy hay không
    valid_run = (
        run["status"] == "completed"
        and run["conclusion"] == "success"
        and run["event"] == "push"
        and run["head_branch"] == "main"
        and run["path"] == ".github/workflows/ci-backend.yml"
        and run["head_repository"]["full_name"] == gh_repo
        and re.fullmatch(r"[0-9a-f]{40}", run["head_sha"])
    )

    if not valid_run:
        raise SystemExit(
            "Expected a successful Backend CI push run "
            "from this repository/main"
        )

    # Trả SHA cho GitHub Actions step output
    with github_output.open("a") as output:
        output.write(f"sha={run['head_sha']}\n")


if __name__ == "__main__":
    main()