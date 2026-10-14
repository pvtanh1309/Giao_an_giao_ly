import os
import sys


def main():
    changes = os.environ.get("CHANGES_RESULT", "")
    should_run = os.environ.get("SHOULD_RUN", "")
    result = os.environ.get("CI_RESULT", "")
    if changes != "success" or should_run not in ("true", "false"):
        print(f"Path filtering failed or returned no valid decision: {changes!r}, {should_run!r}.")
        return 1
    expected = "success" if should_run == "true" else "skipped"
    if result != expected:
        print(f"CI result was {result!r}; expected {expected!r}.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
