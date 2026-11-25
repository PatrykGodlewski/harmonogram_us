variable "oci_profile" {
  description = "Profile in ~/.oci/config."
  type        = string
  default     = "DEFAULT"
}

variable "region" {
  description = "Your home region (Always Free Arm servers exist only there), e.g. eu-frankfurt-1."
  type        = string
}

variable "compartment_ocid" {
  description = "Where to create resources; the tenancy OCID (root compartment) is fine."
  type        = string
}

variable "availability_domain_index" {
  description = "Try 1 or 2 when the first domain reports 'Out of host capacity'."
  type        = number
  default     = 0
}

variable "prefix" {
  type    = string
  default = "harmonogram"
}

variable "ocpus" {
  description = "Always Free: up to 2 OCPUs and 12 GB in total for Arm (A1) servers."
  type        = number
  default     = 2
}

variable "memory_gb" {
  type    = number
  default = 12
}

variable "boot_volume_gb" {
  description = "Always Free: up to 200 GB of block storage in total."
  type        = number
  default     = 100
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/harmonogram_azure.pub"
}

variable "ssh_allowed_cidr" {
  description = "Who may SSH to the server, e.g. your IP as 1.2.3.4/32."
  type        = string
}
