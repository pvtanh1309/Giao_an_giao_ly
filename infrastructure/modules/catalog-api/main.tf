locals {
  name = "${var.project_name}-${var.environment}-catalog-api"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_iam_role" "lambda" {
  name               = local.name
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
  tags               = var.tags
}

resource "aws_iam_role_policy" "lambda" {
  name   = local.name
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_lambda_function" "api" {
  function_name    = local.name
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.12"
  architectures    = ["x86_64"]
  handler          = "catalog_api.handler.lambda_handler"
  memory_size      = 256
  timeout          = 29

  environment {
    variables = {
      TABLE_NAME          = var.table_name
      USER_POOL_ID        = var.user_pool_id
      USER_POOL_CLIENT_ID = var.app_client_id
    }
  }

  depends_on = [aws_iam_role_policy.lambda]
  tags       = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda" {
  for_each            = toset(["Errors", "Throttles"])
  alarm_name          = "${local.name}-${lower(each.value)}"
  namespace           = "AWS/Lambda"
  metric_name         = each.value
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == null ? [] : [var.alarm_topic_arn]
  tags                = var.tags
}
