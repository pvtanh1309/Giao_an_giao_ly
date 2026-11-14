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
variable "password_minimum_length" {
  type    = number
  default = 8
  validation {
    condition     = var.password_minimum_length >= 8 && var.password_minimum_length <= 99
    error_message = "Password minimum must be between 8 and 99."
  }
}
variable "access_token_hours" {
  type    = number
  default = 1
}
variable "refresh_token_days" {
  type    = number
  default = 1095
  validation {
    condition     = var.refresh_token_days >= 1 && var.refresh_token_days <= 3650 && floor(var.refresh_token_days) == var.refresh_token_days
    error_message = "Refresh token validity must be a whole number between 1 and 3650 days."
  }
}
