"""Private versioned S3 media. Clients are created only on invocation."""
import os
import boto3
from botocore.config import Config


class MediaObjects:
    def __init__(self, client=None, bucket=None):
        self.client = client or boto3.client("s3", config=Config(
            signature_version="s3v4", s3={"addressing_style": "virtual"},
            connect_timeout=3, read_timeout=5, retries={"mode": "standard", "max_attempts": 2}))
        self.bucket = bucket or os.environ["MEDIA_BUCKET"]

    def upload_url(self, item):
        return self.client.generate_presigned_url("put_object", Params={"Bucket": self.bucket, "Key": item["objectKey"], "ContentType": item["mimeType"]}, ExpiresIn=300)

    def head(self, item):
        params = {"Bucket": self.bucket, "Key": item["objectKey"]}
        if item.get("objectVersion"):
            params["VersionId"] = item["objectVersion"]
        return self.client.head_object(**params)

    def download_url(self, item):
        return self.client.generate_presigned_url("get_object", Params={"Bucket": self.bucket, "Key": item["objectKey"], "VersionId": item["objectVersion"]}, ExpiresIn=900)

    def delete_all(self, item):
        # Prefix also matches other keys; only remove the exact object's versions.
        paginator = self.client.get_paginator("list_object_versions")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=item["objectKey"]):
            for version in page.get("Versions", []) + page.get("DeleteMarkers", []):
                if version["Key"] == item["objectKey"]:
                    self.client.delete_object(Bucket=self.bucket, Key=version["Key"], VersionId=version["VersionId"])
