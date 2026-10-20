output "api_endpoint" { value = var.domain_name == null ? aws_apigatewayv2_api.api.api_endpoint : "https://${var.domain_name}" }
