"""Check CD configuration merging with fake values and no AWS calls."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[2] / "cd" / "write_environment_config.py"
CERTIFICATE = "arn:aws:acm:us-east-1:000000000000:certificate/offline"


class EnvironmentConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / "cd.auto.tfvars.json"

    def run_writer(self, raw, domain="", certificate=""):
        env = dict(os.environ, TFVARS_JSON=raw,
                   FRONTEND_DOMAIN_NAME=domain,
                   FRONTEND_CERTIFICATE_ARN=certificate)
        return subprocess.run([sys.executable, str(SCRIPT), str(self.output)],
                              env=env, capture_output=True, text=True)

    def test_domain_variables_override_only_frontend_fields(self):
        result = self.run_writer(json.dumps({
            "environment": "dev", "allowed_origins": ["http://localhost:3000"],
            "notification_email": "ops@example.test", "monthly_budget_usd": 17,
            "tags": {"Owner": "offline"},
            "frontend_domain_name": "old.example.test",
            "frontend_certificate_arn": "old-certificate",
        }), " web.example.test ", f" {CERTIFICATE} ")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(self.output.read_text(encoding="utf-8")), {
            "environment": "dev", "allowed_origins": ["http://localhost:3000"],
            "notification_email": "ops@example.test", "monthly_budget_usd": 17,
            "tags": {"Owner": "offline"},
            "frontend_domain_name": "web.example.test",
            "frontend_certificate_arn": CERTIFICATE,
        })
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def test_empty_domain_variables_preserve_the_original_configuration(self):
        for raw in ('{"environment":"dev"}',
                    '{"frontend_domain_name":"old.example.test",'
                    '"frontend_certificate_arn":"existing","tags":{"Name":"Giáo án"}}'):
            with self.subTest(raw=raw):
                result = self.run_writer(raw, " ", " ")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(self.output.read_text(encoding="utf-8")),
                                 json.loads(raw))

    def test_incomplete_domain_pair_does_not_overwrite_configuration(self):
        for domain, certificate in (("web.example.test", ""), ("", CERTIFICATE)):
            with self.subTest(domain=domain):
                self.output.write_text("unchanged", encoding="utf-8")
                result = self.run_writer('{"environment":"dev"}', domain, certificate)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.output.read_text(encoding="utf-8"), "unchanged")
                self.assertIn("Set both FRONTEND_DOMAIN_NAME and FRONTEND_CERTIFICATE_ARN", result.stderr)

    def test_invalid_secret_fails_without_logging_values_or_writing_a_file(self):
        for raw in ('{"private":"offline-private-marker",}',
                    '["offline-private-marker"]', 'null', '',
                    '{"private":"offline-private-marker","budget":NaN}'):
            with self.subTest(raw=raw):
                result = self.run_writer(raw)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("TFVARS_JSON", result.stderr)
                self.assertNotIn("offline-private-marker", result.stdout + result.stderr)
                self.assertNotIn("Traceback", result.stderr)
                self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
