locals {
  name = "${var.project_name}-${var.environment}-content-api"
  routes = toset([
    "GET /manage/lessons",
    "GET /manage/programs",
    "GET /manage/programs/{programId}",
    "GET /lessons",
    "GET /lessons/{lessonId}",
    "GET /programs",
    "GET /programs/{programId}",
    "GET /references",
    "GET /references/{referenceId}",
    "POST /manage/lessons",
    "PUT /manage/lessons/{lessonId}/draft",
    "POST /manage/lessons/{lessonId}/publish",
    "DELETE /manage/lessons/{lessonId}",
    "POST /manage/lessons/{lessonId}/restore",
    "POST /manage/programs",
    "PUT /manage/programs/{programId}/draft",
    "POST /manage/programs/{programId}/publish",
    "DELETE /manage/programs/{programId}",
    "POST /manage/programs/{programId}/restore",
    "GET /manage/references",
    "GET /manage/references/{referenceId}",
    "GET /manage/lessons/{lessonId}",
    "POST /manage/references",
    "PUT /manage/references/{referenceId}/draft",
    "POST /manage/references/{referenceId}/publish",
    "DELETE /manage/references/{referenceId}",
    "POST /manage/references/{referenceId}/restore",
    "POST /manage/lessons/{lessonId}/media-upload-url"
  ])
}
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}
resource "aws_sqs_queue" "stream_failures" {
  name                      = "${local.name}-stream-failures"
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
  name = local.name
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.lambda.arn}:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:ConditionCheckItem"], Resource = var.table_arn },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.table_arn, "${var.table_arn}/index/GSI1"] },
      { Effect = "Allow", Action = ["dynamodb:DescribeStream", "dynamodb:GetRecords", "dynamodb:GetShardIterator"], Resource = var.stream_arn },
      # ListStreams does not support resource-level IAM restrictions.
      { Effect = "Allow", Action = ["dynamodb:ListStreams"], Resource = "*" },
      { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = aws_sqs_queue.stream_failures.arn },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject", "s3:DeleteObject", "s3:DeleteObjectVersion"], Resource = "${var.app_bucket_arn}/lesson-media/*" },
      { Effect = "Allow", Action = ["s3:ListBucketVersions"], Resource = var.app_bucket_arn, Condition = { StringLike = { "s3:prefix" = ["lesson-media/*"] } } }
    ]
  })
}
resource "aws_lambda_function" "api" {
  function_name    = local.name
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.12"
  architectures    = ["x86_64"]
  handler          = "content_api.handler.lambda_handler"
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
resource "aws_apigatewayv2_api" "api" {
  name          = local.name
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = var.allowed_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 300
  }
  tags = var.tags
}
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.api.id
  name             = "cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    audience = [var.app_client_id]
    issuer   = var.user_pool_issuer_url
  }
}
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}
resource "aws_apigatewayv2_route" "routes" {
  for_each             = local.routes
  api_id               = aws_apigatewayv2_api.api.id
  route_key            = each.value
  target               = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.jwt.id
  authorization_scopes = ["aws.cognito.signin.user.admin"]
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit   = 50
    throttling_rate_limit    = 25
    detailed_metrics_enabled = true
  }
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format          = jsonencode({ requestId = "$context.requestId", routeKey = "$context.routeKey", status = "$context.status", responseLength = "$context.responseLength", integrationError = "$context.integrationErrorMessage" })
  }
  tags = var.tags
}

resource "aws_lambda_permission" "gateway" {
  statement_id  = "AllowHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
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
  alarm_name          = "${local.name}-stream-failures"
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
resource "aws_apigatewayv2_domain_name" "api" {
  count       = var.domain_name == null ? 0 : 1
  domain_name = var.domain_name
  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
  lifecycle {
    precondition {
      condition     = var.certificate_arn != null
      error_message = "API custom domains require a certificate in the API region."
    }
  }
  tags = var.tags
}
resource "aws_apigatewayv2_api_mapping" "api" {
  count       = var.domain_name == null ? 0 : 1
  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = aws_apigatewayv2_stage.default.id
}
resource "aws_route53_record" "api" {
  count   = var.domain_name != null && var.hosted_zone_id != null ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
