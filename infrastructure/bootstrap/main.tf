resource "aws_s3_bucket" "s3_terraform_state" {
  bucket = var.bucket_name

  tags = {
    Name      = "giaoan-web-terraform-state"
    ManagedBy = "Terraform"
  }
}

resource "aws_s3_bucket_ownership_controls" "s3_state_ownership" {
  bucket = aws_s3_bucket.s3_terraform_state.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "enable_public_access_block" {
  bucket = aws_s3_bucket.s3_terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "versioning_s3_bucket_state" {
  bucket = aws_s3_bucket.s3_terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encrypt_s3_state" {
  bucket = aws_s3_bucket.s3_terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}