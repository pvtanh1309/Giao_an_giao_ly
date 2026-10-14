import os
import subprocess

def main():
    base = os.environ.get("BASE_SHA", "")
    head = os.environ["HEAD_SHA"]

    ''' 
        If not have base or base = "0000000" -> treat the whole repository as changed
        else compare old commit and new commit, print error if process error, 
        not print error in terminal
    '''
    if not base or set(base) == {"0"}:
        paths = ["."]
    else:
        # PRs compare from the merge base; pushes compare the two event SHAs.
        revision = f"{base}...{head}" if os.environ.get("DIFF_MODE") == "three-dot" else f"{base}..{head}"
        result = subprocess.run(
            ["git", "diff", "--no-renames", "--name-only", "-z", revision],
            check=True,             
            capture_output=True,
            text=True    
        )

        list_path = result.stdout.split("\0")

        paths = []

        for path in list_path:
            if path:
                paths.append(path)


    frontend = backend = terraform = False
    run_all = False
    for path in paths:
        if path.startswith("Frontend/") or path == ".github/workflows/ci-frontend.yml":
            frontend = True
        elif path.startswith("Backend/") or path == ".github/workflows/ci-backend.yml":
            backend = True
        elif path.startswith("infrastructure/") or path == ".github/workflows/ci-terraform.yml":
            terraform = True
        elif path == "scripts/ci/create_release_manifest.py":
            backend = True
        elif path.startswith(("docs/", ".agents/")):
            continue
        elif path in ("README.md", "TODO-INDEX.md"):
            continue
        else:
            run_all = True

    if run_all:
        frontend = backend = terraform = True

    # GITHUB_OUTPUT: special environment variable automatically created by GitHub Actions
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write(f"frontend={str(frontend).lower()}\n")
        output.write(f"backend={str(backend).lower()}\n")
        output.write(f"terraform={str(terraform).lower()}\n")


if __name__ == "__main__":
    main()
