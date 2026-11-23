output "fqdn" {
  description = "The site's address (public site on 443, admin panel on 8443)."
  value       = azurerm_public_ip.app.fqdn
}

output "public_ip" {
  value = azurerm_public_ip.app.ip_address
}

output "ssh" {
  value = "ssh -i ${trimsuffix(pathexpand(var.ssh_public_key_path), ".pub")} ${var.admin_username}@${azurerm_public_ip.app.fqdn}"
}

output "database_url" {
  description = "For DATABASE_URL in deploy/.env.production (TLS required by Azure)."
  value       = "postgresql://harmonogram:${random_password.db.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/harmonogram_us?sslmode=require"
  sensitive   = true
}
