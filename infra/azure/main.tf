resource "azurerm_resource_group" "main" {
  name     = "${var.prefix}-rg"
  location = var.location
}

# ——— Network: one subnet, a static public address with a DNS name ———

resource "azurerm_virtual_network" "main" {
  name                = "${var.prefix}-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.20.0.0/16"]
}

resource "azurerm_subnet" "app" {
  name                 = "app"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.20.1.0/24"]
}

resource "azurerm_public_ip" "app" {
  name                = "${var.prefix}-ip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = var.dns_label
}

resource "azurerm_network_security_group" "app" {
  name                = "${var.prefix}-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "ssh"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.ssh_allowed_cidr
    destination_address_prefix = "*"
  }

  # 80: certificates and redirect; 443: public site; 8443: admin panel (same name, own origin).
  security_rule {
    name                       = "web"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["80", "443", "8443"]
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "app" {
  name                = "${var.prefix}-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "primary"
    subnet_id                     = azurerm_subnet.app.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.app.id
  }
}

resource "azurerm_network_interface_security_group_association" "app" {
  network_interface_id      = azurerm_network_interface.app.id
  network_security_group_id = azurerm_network_security_group.app.id
}

# ——— The server: Ubuntu with Docker (cloud-init); images come from ghcr.io ———

resource "azurerm_linux_virtual_machine" "app" {
  name                  = "${var.prefix}-vm"
  location              = azurerm_resource_group.main.location
  resource_group_name   = azurerm_resource_group.main.name
  size                  = var.vm_size
  admin_username        = var.admin_username
  network_interface_ids = [azurerm_network_interface.app.id]
  custom_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
    admin_username = var.admin_username
  }))

  admin_ssh_key {
    username   = var.admin_username
    public_key = file(pathexpand(var.ssh_public_key_path))
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = 64
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
}

# ——— Database: managed Postgres, reachable only from the server ———

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                          = "${var.prefix}-${var.dns_label}-db"
  location                      = azurerm_resource_group.main.location
  resource_group_name           = azurerm_resource_group.main.name
  version                       = var.postgres_version
  sku_name                      = var.postgres_sku
  storage_mb                    = 32768
  backup_retention_days         = 7
  administrator_login           = "harmonogram"
  administrator_password        = random_password.db.result
  public_network_access_enabled = true

  lifecycle {
    # Azure picks the availability zone; changing it later would recreate the server.
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "harmonogram_us"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "app" {
  name             = "app-server"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = azurerm_public_ip.app.ip_address
  end_ip_address   = azurerm_public_ip.app.ip_address
}
