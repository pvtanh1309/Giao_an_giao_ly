terraform {
  backend "s3" {
    bucket       = "gxthaian-giaoan-web-2026"
    key          = "giaoan-web/dev/terraform.tfstate"
    region       = "ap-southeast-1"
    use_lockfile = true
  }
}