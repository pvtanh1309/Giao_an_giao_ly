locals {
  name = "${var.project_name}-${var.environment}-content-api"
  route_targets = {
    "GET /me/lessons/{lessonId}/notes"                 = "lessons"
    "POST /me/lessons/{lessonId}/notes"                = "lessons"
    "PUT /me/lessons/{lessonId}/notes/{noteId}"        = "lessons"
    "DELETE /me/lessons/{lessonId}/notes/{noteId}"     = "lessons"
    "GET /manage/lessons"                              = "lessons"
    "GET /lessons"                                     = "lessons"
    "GET /lessons/{lessonId}"                          = "lessons"
    "POST /manage/lessons"                             = "lessons"
    "PUT /manage/lessons/{lessonId}/draft"             = "lessons"
    "POST /manage/lessons/{lessonId}/publish"          = "lessons"
    "DELETE /manage/lessons/{lessonId}"                = "lessons"
    "POST /manage/lessons/{lessonId}/restore"          = "lessons"
    "GET /manage/lessons/{lessonId}"                   = "lessons"
    "POST /manage/lessons/{lessonId}/media-upload-url" = "lessons"

    "GET /manage/programs"                          = "catalog"
    "GET /manage/programs/{programId}"              = "catalog"
    "GET /programs"                                 = "catalog"
    "GET /programs/{programId}"                     = "catalog"
    "POST /manage/programs"                         = "catalog"
    "PUT /manage/programs/{programId}/draft"        = "catalog"
    "POST /manage/programs/{programId}/publish"     = "catalog"
    "DELETE /manage/programs/{programId}"           = "catalog"
    "POST /manage/programs/{programId}/restore"     = "catalog"
    "GET /references"                               = "catalog"
    "GET /references/{referenceId}"                 = "catalog"
    "GET /manage/references"                        = "catalog"
    "GET /manage/references/{referenceId}"          = "catalog"
    "POST /manage/references"                       = "catalog"
    "PUT /manage/references/{referenceId}/draft"    = "catalog"
    "POST /manage/references/{referenceId}/publish" = "catalog"
    "DELETE /manage/references/{referenceId}"       = "catalog"
    "POST /manage/references/{referenceId}/restore" = "catalog"
  }
}
resource "aws_cloudwatch_log_group" "legacy_lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
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
  for_each               = { lessons = var.lessons_lambda_invoke_arn, catalog = var.catalog_lambda_invoke_arn }
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_route" "routes" {
  for_each             = local.route_targets
  api_id               = aws_apigatewayv2_api.api.id
  route_key            = each.key
  target               = "integrations/${aws_apigatewayv2_integration.lambda[each.value].id}"
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
  for_each      = { lessons = var.lessons_lambda_function_name, catalog = var.catalog_lambda_function_name }
  statement_id  = "AllowHttpApi${title(each.key)}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
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
