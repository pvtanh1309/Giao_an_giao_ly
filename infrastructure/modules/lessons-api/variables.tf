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
variable "app_client_id" { type = string }
variable "lambda_zip_path" { type = string }
variable "app_bucket_name" { type = string }
variable "app_bucket_arn" { type = string }
variable "log_retention_days" {
  type    = number
  default = 30
}
variable "alarm_topic_arn" {
  type    = string
  default = null
}
