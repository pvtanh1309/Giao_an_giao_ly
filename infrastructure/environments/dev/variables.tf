variable "aws_region" {
  type    = string
  default = "ap-southeast-1"
}
variable "environment" {
  type    = string
  default = "dev"
  validation {
    condition     = var.environment == "dev"
    error_message = "This root is only for dev."
  }
}
variable "project_name" {
  type    = string
  default = "giaoan"
}
variable "tags" {
  type    = map(string)
  default = {}
}
variable "allowed_origins" {
  description = "Additional exact frontend origins; CloudFront/custom frontend origins are included automatically."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for origin in var.allowed_origins : can(regex("^https?://[^/]+$", origin)) && !strcontains(origin, "*")])
    error_message = "Use exact http(s) origins without wildcards or paths."
  }
}
variable "content_lambda_zip_path" {
  type    = string
  default = null
}
variable "users_lambda_zip_path" {
  type    = string
  default = null
}
variable "log_retention_days" {
  type    = number
  default = 14
}
variable "notification_email" {
  description = "Optional SNS alarm subscription; owner must confirm the AWS email."
  type        = string
  default     = null
}
variable "budget_email" {
  description = "Setting an email enables monthly cost budget alerts."
  type        = string
  default     = null
}
variable "monthly_budget_usd" {
  type    = number
  default = 10
}
variable "frontend_domain_name" {
  type    = string
  default = null
}
variable "frontend_certificate_arn" {
  description = "Existing ACM certificate in us-east-1."
  type        = string
  default     = null
}
variable "content_api_domain_name" {
  type    = string
  default = null
}
variable "users_api_domain_name" {
  type    = string
  default = null
}
variable "api_certificate_arn" {
  description = "Existing ACM certificate in aws_region covering both API domains."
  type        = string
  default     = null
}
variable "hosted_zone_id" {
  description = "Optional existing public hosted zone for aliases."
  type        = string
  default     = null
}
