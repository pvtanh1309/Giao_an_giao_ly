"""Explicit operator command to seed an initial admin; never run by Terraform.

Password is prompted without echo and never written to a file, command argument or log.
"""
import argparse
import getpass
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import boto3
from shared.db import Store
from shared.models import now, normalize


def main():
    parser = argparse.ArgumentParser(description="Create initial Cognito admin and ACCOUNT record")
    parser.add_argument("--pool-id", required=True)
    parser.add_argument("--table-name", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--region", default="ap-southeast-1")
    parser.add_argument("--profile")
    parser.add_argument("--expected-account-id", required=True)
    args = parser.parse_args()
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    identity = session.client("sts").get_caller_identity()
    if identity["Account"] != args.expected_account_id:
        parser.error("AWS account does not match --expected-account-id")
    client = session.client("cognito-idp")
    store = Store(session.client("dynamodb"), args.table_name)
    pool = client.describe_user_pool(UserPoolId=args.pool_id)["UserPool"]
    print(f"Account {identity['Account']}; pool {pool['Name']}; table {args.table_name}")
    if input("Type CREATE ADMIN to continue: ") != "CREATE ADMIN":
        return
    password = getpass.getpass("Permanent password: ")
    if password != getpass.getpass("Confirm password: "):
        parser.error("Passwords do not match")
    username = None
    item = None
    try:
        user = client.admin_create_user(UserPoolId=args.pool_id, Username=args.email, MessageAction="SUPPRESS",
                                        UserAttributes=[{"Name": "email", "Value": args.email}, {"Name": "email_verified", "Value": "true"}])["User"]
        username = user["Username"]
        sub = next(attribute["Value"] for attribute in user["Attributes"] if attribute["Name"] == "sub")
        client.admin_set_user_password(UserPoolId=args.pool_id, Username=username, Password=password, Permanent=True)
        client.admin_add_user_to_group(UserPoolId=args.pool_id, Username=username, GroupName="admin")
        stamp = now()
        item = {"PK": "ACCOUNT#" + sub, "SK": "PROFILE", "entityType": "ACCOUNT", "cognitoSub": sub,
                "cognitoUsername": username, "email": args.email, "role": "ADMIN", "accountStatus": "ACTIVE",
                "version": 1, "createdAt": stamp, "updatedAt": stamp, "createdBy": sub, "updatedBy": sub,
                "GSI1PK": "DIRECTORY#ACCOUNT", "GSI1SK": normalize(args.email) + "#" + sub}
        store.put(item, create=True)
        print("Admin created. Cognito sub:", sub)
    except Exception:
        # A write timeout may follow a successful commit. Do not delete a committed user.
        if username:
            try:
                committed = store.get(item["PK"]) if item else None
                if not committed:
                    client.admin_delete_user(UserPoolId=args.pool_id, Username=username)
            except Exception:
                print("Reconcile Cognito user manually:", username, file=sys.stderr)
        raise SystemExit("Admin creation failed; inspect Cognito/ACCOUNT before retrying.") from None


if __name__ == "__main__":
    main()
