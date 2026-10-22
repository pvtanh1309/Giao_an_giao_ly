data "aws_iam_policy_document" "lambda" {
  statement {
    effect    = "Allow"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.lambda.arn}:*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:ConditionCheckItem",
    ]
    resources = [var.table_arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["dynamodb:Query"]
    resources = [var.table_arn, "${var.table_arn}/index/GSI1"]
  }

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:DescribeStream",
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
    ]
    resources = [var.stream_arn]
  }

  # ListStreams does not support resource-level IAM restrictions.
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:ListStreams"]
    resources = ["*"]
  }

  statement {
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.stream_failures.arn]
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:DeleteObjectVersion",
    ]
    resources = ["${var.app_bucket_arn}/lesson-media/*"]
  }

  statement {
    effect    = "Allow"
    actions   = ["s3:ListBucketVersions"]
    resources = [var.app_bucket_arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["lesson-media/*"]
    }
  }
}
