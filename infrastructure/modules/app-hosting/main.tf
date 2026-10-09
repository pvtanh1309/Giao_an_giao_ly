data "aws_caller_identity" "current" {}
resource "aws_s3_bucket" "app" {
  bucket = "${var.project_name}-${var.environment}-app-${data.aws_caller_identity.current.account_id}"
  tags   = var.tags
}
resource "aws_s3_bucket_public_access_block" "app" {
  bucket                  = aws_s3_bucket.app.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_ownership_controls" "app" {
  bucket = aws_s3_bucket.app.id
  rule { object_ownership = "BucketOwnerEnforced" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "app" {
  bucket = aws_s3_bucket.app.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_versioning" "app" {
  bucket = aws_s3_bucket.app.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_cors_configuration" "app" {
  bucket = aws_s3_bucket.app.id
  cors_rule {
    allowed_origins = distinct(concat(var.frontend_allowed_origins, ["https://${aws_cloudfront_distribution.app.domain_name}"], var.domain_name == null ? [] : ["https://${var.domain_name}"]))
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_headers = ["Content-Type"]
    expose_headers  = ["ETag", "x-amz-version-id"]
    max_age_seconds = 300
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "app" {
  bucket = aws_s3_bucket.app.id
  rule {
    id     = "abort-incomplete-media"
    status = "Enabled"
    filter { prefix = "lesson-media/" }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}
resource "aws_cloudfront_origin_access_control" "app" {
  name                              = "${var.project_name}-${var.environment}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
resource "aws_cloudfront_function" "routes" {
  name    = "${var.project_name}-${var.environment}-routes"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri.endsWith('/')) request.uri += 'index.html';
      else if (uri.split('/').pop().indexOf('.') === -1) request.uri += '.html';
      return request;
    }
  JS
}
resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = var.domain_name == null ? [] : [var.domain_name]
  price_class         = "PriceClass_200"
  origin {
    domain_name              = aws_s3_bucket.app.bucket_regional_domain_name
    origin_id                = "frontend"
    origin_path              = "/frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.app.id
  }
  default_cache_behavior {
    target_origin_id           = "frontend"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03"
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.routes.arn
    }
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate {
    cloudfront_default_certificate = var.domain_name == null
    acm_certificate_arn            = var.certificate_arn
    ssl_support_method             = var.domain_name == null ? null : "sni-only"
    minimum_protocol_version       = var.domain_name == null ? "TLSv1" : "TLSv1.2_2021"
  }
  lifecycle {
    precondition {
      condition     = var.domain_name == null || var.certificate_arn != null
      error_message = "A frontend domain requires an ACM certificate in us-east-1."
    }
  }
  tags = var.tags
}
resource "aws_s3_bucket_policy" "app" {
  bucket = aws_s3_bucket.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "CloudFrontFrontendOnly", Effect = "Allow", Principal = { Service = "cloudfront.amazonaws.com" }, Action = "s3:GetObject", Resource = "${aws_s3_bucket.app.arn}/frontend/*", Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.app.arn } } },
      { Sid = "DenyInsecureTransport", Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.app.arn, "${aws_s3_bucket.app.arn}/*"], Condition = { Bool = { "aws:SecureTransport" = "false" } } }
    ]
  })
}
resource "aws_route53_record" "app" {
  count   = var.domain_name != null && var.hosted_zone_id != null ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}
