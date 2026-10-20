moved {
  from = module.content_api.aws_sqs_queue.stream_failures
  to   = module.lessons_api.aws_sqs_queue.stream_failures
}

moved {
  from = module.content_api.aws_cloudwatch_metric_alarm.stream_failures
  to   = module.lessons_api.aws_cloudwatch_metric_alarm.stream_failures
}

moved {
  from = module.content_api.aws_lambda_event_source_mapping.cleanup
  to   = module.lessons_api.aws_lambda_event_source_mapping.cleanup
}

moved {
  from = module.content_api.aws_cloudwatch_log_group.lambda
  to   = module.content_api.aws_cloudwatch_log_group.legacy_lambda
}

provider "aws" {
  region = var.aws_region
  default_tags { tags = local.tags }
}
locals {
  tags            = merge(var.tags, { Project = var.project_name, Environment = var.environment, ManagedBy = "Terraform" })
  allowed_origins = distinct(concat(var.allowed_origins, [module.app_hosting.frontend_url, "https://${module.app_hosting.cloudfront_domain_name}"]))
}
module "identity" {
  source       = "../../modules/identity"
  environment  = var.environment
  project_name = var.project_name
  tags         = local.tags
}
module "database" {
  source                      = "../../modules/database"
  environment                 = var.environment
  project_name                = var.project_name
  tags                        = local.tags
  enable_pitr                 = false
  deletion_protection_enabled = false
}
module "app_hosting" {
  source                   = "../../modules/app-hosting"
  environment              = var.environment
  project_name             = var.project_name
  tags                     = local.tags
  frontend_allowed_origins = var.allowed_origins
  domain_name              = var.frontend_domain_name
  certificate_arn          = var.frontend_certificate_arn
  hosted_zone_id           = var.hosted_zone_id
}

resource "aws_sns_topic" "alarms" {
  name = "${var.project_name}-${var.environment}-alarms"
  tags = local.tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.notification_email == null ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

module "lessons_api" {
  source             = "../../modules/lessons-api"
  environment        = var.environment
  project_name       = var.project_name
  tags               = local.tags
  table_name         = module.database.table_name
  table_arn          = module.database.table_arn
  stream_arn         = module.database.stream_arn
  app_bucket_name    = module.app_hosting.app_bucket_name
  app_bucket_arn     = module.app_hosting.app_bucket_arn
  user_pool_id       = module.identity.user_pool_id
  app_client_id      = module.identity.app_client_id
  lambda_zip_path    = coalesce(var.lessons_lambda_zip_path, "${path.module}/../../../Backend/dist/lessons-api.zip")
  log_retention_days = var.log_retention_days
  alarm_topic_arn    = aws_sns_topic.alarms.arn
}

module "catalog_api" {
  source             = "../../modules/catalog-api"
  environment        = var.environment
  project_name       = var.project_name
  tags               = local.tags
  table_name         = module.database.table_name
  table_arn          = module.database.table_arn
  user_pool_id       = module.identity.user_pool_id
  app_client_id      = module.identity.app_client_id
  lambda_zip_path    = coalesce(var.catalog_lambda_zip_path, "${path.module}/../../../Backend/dist/catalog-api.zip")
  log_retention_days = var.log_retention_days
  alarm_topic_arn    = aws_sns_topic.alarms.arn
}

module "content_api" {
  source                       = "../../modules/content-api"
  environment                  = var.environment
  project_name                 = var.project_name
  tags                         = local.tags
  user_pool_issuer_url         = module.identity.issuer_url
  app_client_id                = module.identity.app_client_id
  lessons_lambda_invoke_arn    = module.lessons_api.lambda_invoke_arn
  lessons_lambda_function_name = module.lessons_api.lambda_function_name
  catalog_lambda_invoke_arn    = module.catalog_api.lambda_invoke_arn
  catalog_lambda_function_name = module.catalog_api.lambda_function_name
  allowed_origins              = local.allowed_origins
  log_retention_days           = var.log_retention_days
  domain_name                  = var.content_api_domain_name
  certificate_arn              = var.api_certificate_arn
  hosted_zone_id               = var.hosted_zone_id
}

module "user_api" {
  source               = "../../modules/user-api"
  environment          = var.environment
  project_name         = var.project_name
  tags                 = local.tags
  table_name           = module.database.table_name
  table_arn            = module.database.table_arn
  stream_arn           = module.database.stream_arn
  user_pool_id         = module.identity.user_pool_id
  user_pool_arn        = module.identity.user_pool_arn
  user_pool_issuer_url = module.identity.issuer_url
  app_client_id        = module.identity.app_client_id
  allowed_origins      = local.allowed_origins
  lambda_zip_path      = coalesce(var.users_lambda_zip_path, "${path.module}/../../../Backend/dist/users-api.zip")
  log_retention_days   = var.log_retention_days
  alarm_topic_arn      = aws_sns_topic.alarms.arn
  domain_name          = var.users_api_domain_name
  certificate_arn      = var.api_certificate_arn
  hosted_zone_id       = var.hosted_zone_id
}

resource "aws_budgets_budget" "monthly" {
  count        = var.budget_email == null ? 0 : 1
  name         = "${var.project_name}-${var.environment}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_filter {
    name   = "TagKeyValue"
    values = [format("user:Environment$%s", var.environment)]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_email]
  }

  # Alert when forecast budget overcome 100  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }
}
