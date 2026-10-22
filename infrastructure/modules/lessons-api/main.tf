locals {
  name = "${var.project_name}-${var.environment}-lessons-api"
  # Keep the existing physical queue name so Terraform can adopt it without
  # replacing the queue or discarding any failed stream records.
  failure_queue_name = "${var.project_name}-${var.environment}-content-api-stream-failures"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_sqs_queue" "stream_failures" {
  name                      = local.failure_queue_name
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = var.tags
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
  handler          = "lessons_api.handler.lambda_handler"
  memory_size      = 256
  timeout          = 29

  environment {
    variables = {
      TABLE_NAME          = var.table_name
      USER_POOL_ID        = var.user_pool_id
      USER_POOL_CLIENT_ID = var.app_client_id
      MEDIA_BUCKET        = var.app_bucket_name
    }
  }

  depends_on = [aws_iam_role_policy.lambda]
  tags       = var.tags
}

resource "aws_lambda_event_source_mapping" "cleanup" {
  event_source_arn                   = var.stream_arn
  function_name                      = aws_lambda_function.api.arn
  starting_position                  = "TRIM_HORIZON"
  batch_size                         = 10
  maximum_batching_window_in_seconds = 1
  maximum_retry_attempts             = 10
  maximum_record_age_in_seconds      = 86400
  bisect_batch_on_function_error     = true
  function_response_types            = ["ReportBatchItemFailures"]

  filter_criteria {
    filter {
      pattern = jsonencode({ eventName = ["REMOVE"], dynamodb = { OldImage = { PK = { S = [{ prefix = "MEDIA#" }] } } } })
    }
  }

  destination_config {
    on_failure { destination_arn = aws_sqs_queue.stream_failures.arn }
  }

  depends_on = [aws_iam_role_policy.lambda]
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

resource "aws_cloudwatch_metric_alarm" "iterator_age" {
  alarm_name          = "${local.name}-iterator-age"
  namespace           = "AWS/Lambda"
  metric_name         = "IteratorAge"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 3600000
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == null ? [] : [var.alarm_topic_arn]
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "stream_failures" {
  # Keep the established alarm name while retaining the queue and its history.
  alarm_name          = "${var.project_name}-${var.environment}-content-api-stream-failures"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.stream_failures.name }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == null ? [] : [var.alarm_topic_arn]
  tags                = var.tags
}
