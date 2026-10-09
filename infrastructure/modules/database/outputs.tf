output "table_name" { value = aws_dynamodb_table.app.name }
output "table_arn" { value = aws_dynamodb_table.app.arn }
output "stream_arn" { value = aws_dynamodb_table.app.stream_arn }
