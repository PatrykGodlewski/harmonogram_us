terraform {
  required_version = ">= 1.6"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 9.14"
    }
  }
}

# Credentials from an API key (Profile → API keys → Add API key; paste the shown config
# into ~/.oci/config). Nothing secret lives in this directory.
provider "oci" {
  config_file_profile = var.oci_profile
  region              = var.region
}
