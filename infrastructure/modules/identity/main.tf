resource "aws_cognito_user_pool" "cognito_user_factory" {
  name = "${var.project_name}-${var.environment}-users"

  deletion_protection      = var.environment == "prod" ? "ACTIVE" : "INACTIVE"
  mfa_configuration        = "OFF"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = var.password_minimum_length
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  tags = var.tags
}

resource "aws_cognito_user_pool_client" "giaoan_web_user" {
  name         = "${var.project_name}-${var.environment}-browser"
  user_pool_id = aws_cognito_user_pool.cognito_user_factory.id

  generate_secret         = false
  enable_token_revocation = true

  prevent_user_existence_errors = "ENABLED"

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # expriration time of the access token 
  access_token_validity = var.access_token_hours # 1 hour

  # expriration time of the access token 
  id_token_validity      = var.access_token_hours
  refresh_token_validity = var.refresh_token_days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.cognito_user_factory.id
  description  = "managed_by_terraform"
  precedence   = 10
}

resource "aws_cognito_user_group" "editor" {
  name         = "editor"
  user_pool_id = aws_cognito_user_pool.cognito_user_factory.id
  description  = "managed_by_terraform"
  precedence   = 10
}

resource "aws_cognito_user_group" "reader" {
  name         = "reader"
  user_pool_id = aws_cognito_user_pool.cognito_user_factory.id
  description  = "managed_by_terraform"
  precedence   = 10
}
