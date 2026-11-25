output "public_ip" {
  description = "Point your DNS name (e.g. DuckDNS) at this address."
  value       = oci_core_instance.app.public_ip
}

output "ssh" {
  value = "ssh -i ${trimsuffix(pathexpand(var.ssh_public_key_path), ".pub")} ubuntu@${oci_core_instance.app.public_ip}"
}
