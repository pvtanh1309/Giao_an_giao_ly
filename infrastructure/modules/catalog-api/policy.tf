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
}
