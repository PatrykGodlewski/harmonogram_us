variable "subscription_id" {
  description = "Azure subscription (az account show --query id -o tsv)."
  type        = string
}

variable "location" {
  description = "Azure for Students allows only some regions (swedencentral, germanywestcentral, italynorth, spaincentral, uaenorth)."
  type        = string
  default     = "germanywestcentral"
}

variable "prefix" {
  description = "Name prefix for every resource."
  type        = string
  default     = "harmonogram"
}

variable "dns_label" {
  description = "Public address: <dns_label>.<location>.cloudapp.azure.com (must be unique in the region)."
  type        = string
}

variable "vm_size" {
  description = "A size inside the student free allowance (750 h/month)."
  type        = string
  default     = "Standard_B2ats_v2"
}

variable "admin_username" {
  type    = string
  default = "deploy"
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/harmonogram_azure.pub"
}

variable "ssh_allowed_cidr" {
  description = "Who may SSH to the server, e.g. your IP as 1.2.3.4/32."
  type        = string
}

variable "postgres_sku" {
  description = "Burstable B1ms is inside the free allowance."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_version" {
  type    = string
  default = "16"
}
