output "user_pool_id" { value = aws_cognito_user_pool.cognito_user_factory.id }
output "user_pool_arn" { value = aws_cognito_user_pool.cognito_user_factory.arn }
output "app_client_id" { value = aws_cognito_user_pool_client.giaoan_web_user.id }
output "issuer_url" { value = "https://${aws_cognito_user_pool.cognito_user_factory.endpoint}" }
