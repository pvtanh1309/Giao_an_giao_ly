output "app_bucket_name" { value = aws_s3_bucket.app.id }
output "app_bucket_arn" { value = aws_s3_bucket.app.arn }
output "cloudfront_domain_name" { value = aws_cloudfront_distribution.app.domain_name }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.app.id }
output "frontend_url" { value = var.domain_name == null ? "https://${aws_cloudfront_distribution.app.domain_name}" : "https://${var.domain_name}" }
