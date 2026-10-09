resource "aws_dynamodb_table" "app" {
  name                        = "${var.project_name}-${var.environment}"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "PK"
  range_key                   = "SK"
  deletion_protection_enabled = var.environment == "prod" || var.deletion_protection_enabled
  stream_enabled              = true
  stream_view_type            = "NEW_AND_OLD_IMAGES"
  dynamic "attribute" {
    for_each = toset(["PK", "SK", "GSI1PK", "GSI1SK"])
    content {
      name = attribute.value
      type = "S"
    }
  }
  global_secondary_index {
    name = "GSI1"
    key_schema {
      attribute_name = "GSI1PK"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "GSI1SK"
      key_type       = "RANGE"
    }
    projection_type    = "INCLUDE"
    non_key_attributes = ["entityType", "lessonId", "programId", "referenceId", "catechistId", "cognitoSub", "title", "normalizedTitle", "summary", "description", "level", "sublevel", "lessonNumber", "durationMinutes", "category", "name", "normalizedName", "email", "normalizedEmail", "phone", "group", "role", "status", "accountStatus", "hasDraft", "hasPublished", "version", "createdAt", "updatedAt", "publishedAt", "deletedAt", "purgeAt", "createdBy", "updatedBy", "publishedBy"]
  }
  ttl {
    attribute_name = "purgeAt"
    enabled        = true
  }
  point_in_time_recovery { enabled = var.environment == "prod" || var.enable_pitr }
  server_side_encryption { enabled = true }
  tags = var.tags
}
