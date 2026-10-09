variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}
variable "project_name" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "table_name" { type = string }
variable "table_arn" { type = string }
variable "stream_arn" { type = string }
variable "user_pool_id" { type = string }
variable "user_pool_arn" { type = string }
variable "user_pool_issuer_url" { type = string }
variable "app_client_id" { type = string }
variable "lambda_zip_path" { type = string }
variable "allowed_origins" { type = list(string) }
variable "log_retention_days" {
  type    = number
  default = 30
}
variable "alarm_topic_arn" {
  type    = string
  default = null
}
variable "domain_name" {
  type    = string
  default = null
}
variable "certificate_arn" {
  type    = string
  default = null
}
variable "hosted_zone_id" {
  type    = string
  default = null
}
