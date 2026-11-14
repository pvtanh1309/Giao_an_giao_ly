"""Merge optional frontend domain variables into the private CD configuration."""
import argparse
import json
import os
from pathlib import Path


def reject_constant(_value):
    raise ValueError("Non-JSON number")


def environment_config(raw, domain, certificate, zone_id):
    try:
        config = json.loads(raw, parse_constant=reject_constant)
        if not isinstance(config, dict):
            raise ValueError("Expected object")
        # Reject non-finite numbers such as 1e1000 as well as NaN/Infinity.
        json.dumps(config, allow_nan=False)
    except (ValueError, RecursionError):
        raise ValueError("TFVARS_JSON must contain a valid JSON object.") from None

    domain, certificate = domain.strip(), certificate.strip()
    if bool(domain) != bool(certificate):
        raise ValueError("Set both FRONTEND_DOMAIN_NAME and FRONTEND_CERTIFICATE_ARN, or leave both empty.")
    if domain:
        config["frontend_domain_name"] = domain
        config["frontend_certificate_arn"] = certificate
    zone_id = zone_id.strip()
    if zone_id:
        config["hosted_zone_id"] = zone_id
    return config


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        config = environment_config(os.environ.get("TFVARS_JSON", ""),
                                    os.environ.get("FRONTEND_DOMAIN_NAME", ""),
                                    os.environ.get("FRONTEND_CERTIFICATE_ARN", ""),
                                    os.environ.get("HOSTED_ZONE_ID", ""))
    except ValueError as error:
        raise SystemExit(str(error)) from None
    args.output.write_text(json.dumps(config, ensure_ascii=False, allow_nan=False,
                                      indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
