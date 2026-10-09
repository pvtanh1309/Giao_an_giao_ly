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
variable "frontend_allowed_origins" {
  type    = list(string)
  default = []
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
