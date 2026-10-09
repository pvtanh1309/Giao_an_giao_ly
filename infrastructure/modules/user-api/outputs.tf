output "api_endpoint" { value = var.domain_name == null ? aws_apigatewayv2_api.api.api_endpoint : "https://${var.domain_name}" }
output "lambda_arn" { value = aws_lambda_function.api.arn }
output "lambda_function_name" { value = aws_lambda_function.api.function_name }
output "stream_failure_queue_url" { value = aws_sqs_queue.stream_failures.url }
