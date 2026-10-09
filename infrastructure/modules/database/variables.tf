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
variable "enable_pitr" {
  type    = bool
  default = false
}
variable "deletion_protection_enabled" {
  type    = bool
  default = false
}
