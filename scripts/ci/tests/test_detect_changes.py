"""Exercise path filtering against real temporary Git histories; no network."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "detect_changes.py"


class ChangeDetectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git("init", "-b", "main")
        self.git("config", "user.email", "offline@example.invalid")
        self.git("config", "user.name", "Offline CI test")
        self.base = self.commit("README.md")

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, check=True,
                              capture_output=True, text=True).stdout.strip()

    def commit(self, path):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("test\n", encoding="utf-8")
        self.git("add", path)
        self.git("commit", "-m", "offline fixture")
        return self.git("rev-parse", "HEAD")

    def detect(self, base, head, mode="two-dot"):
        output = self.root / "outputs"
        output.write_text("", encoding="utf-8")
        env = dict(os.environ, BASE_SHA=base, HEAD_SHA=head,
                   DIFF_MODE=mode, GITHUB_OUTPUT=str(output))
        subprocess.run([sys.executable, str(SCRIPT)], cwd=self.root,
                       env=env, check=True, capture_output=True)
        return dict(line.split("=", 1) for line in output.read_text().splitlines())

    def test_pr_ignores_unrelated_changes_added_to_base_branch(self):
        self.git("checkout", "-b", "feature")
        head = self.commit("Backend/handler.py")
        self.git("checkout", "main")
        base = self.commit("Frontend/app/page.tsx")
        self.assertEqual(self.detect(base, head, "three-dot"),
                         dict(frontend="false", backend="true", terraform="false"))
        self.assertEqual(self.detect(base, head)["frontend"], "true")

    def test_paths_select_only_the_affected_component(self):
        for path, component in [("Frontend/app.ts", "frontend"),
                                ("Backend/handler.py", "backend"),
                                ("infrastructure/main.tf", "terraform")]:
            with self.subTest(path=path):
                self.git("checkout", "-B", "fixture", self.base)
                head = self.commit(path)
                expected = dict.fromkeys(["frontend", "backend", "terraform"], "false")
                expected[component] = "true"
                self.assertEqual(self.detect(self.base, head), expected)

    def test_docs_only_skip_component_jobs(self):
        head = self.commit("docs/example.md")
        self.assertEqual(set(self.detect(self.base, head).values()), {"false"})

    def test_unknown_path_runs_every_component(self):
        head = self.commit("scripts/ci/shared.py")
        self.assertEqual(set(self.detect(self.base, head).values()), {"true"})

    def test_missing_or_zero_base_runs_every_component(self):
        for base in ("", "0" * 40):
            with self.subTest(base=base):
                self.assertEqual(set(self.detect(base, self.base).values()), {"true"})

    def test_invalid_revision_fails_instead_of_skipping_checks(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.detect("invalid-sha", self.base)


if __name__ == "__main__":
    unittest.main()
