output "s3_states_arn" {
    description = "Bucket storage state arn of terraform"
    value       = aws_s3_bucket.s3_terraform_state.arn
}

output "s3_states_name" {
    description = "Name Bucket storage state of terraform"
    value       = aws_s3_bucket.s3_terraform_state.id
}
