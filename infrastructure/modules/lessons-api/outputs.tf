output "lambda_arn" { value = aws_lambda_function.api.arn }
output "lambda_invoke_arn" { value = aws_lambda_function.api.invoke_arn }
output "lambda_function_name" { value = aws_lambda_function.api.function_name }
output "stream_failure_queue_url" { value = aws_sqs_queue.stream_failures.url }
