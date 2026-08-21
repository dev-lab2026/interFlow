############################################
# Resource Group (already exists)
############################################

data "azurerm_resource_group" "rg" {
  name = "rg-interflow"
}

############################################
# Virtual Network (already exists)
############################################

data "azurerm_virtual_network" "vnet" {
  name                = "vnet-interflow"
  resource_group_name = data.azurerm_resource_group.rg.name
}

############################################
# Subnet (already exists)
############################################

data "azurerm_subnet" "subnet" {
  name                 = "subnet1"
  resource_group_name  = data.azurerm_resource_group.rg.name
  virtual_network_name = data.azurerm_virtual_network.vnet.name
}

############################################
# Network Security Group (already exists)
############################################

data "azurerm_network_security_group" "nsg" {
  name                = "interflow-nsg"
  resource_group_name = data.azurerm_resource_group.rg.name
}

############################################
# Public IP (already exists)
############################################

data "azurerm_public_ip" "publicip" {
  name                = "interflow-ip"
  resource_group_name = data.azurerm_resource_group.rg.name
}

############################################
# Network Interface (already exists)
############################################

data "azurerm_network_interface" "nic" {
  name                = "interflow-nic"
  resource_group_name = data.azurerm_resource_group.rg.name
}

############################################
# Virtual Machine (Terraform creates this)
############################################

resource "azurerm_linux_virtual_machine" "vm" {
  name                = var.vm_name
  resource_group_name = data.azurerm_resource_group.rg.name
  location            = data.azurerm_resource_group.rg.location
  size                = "Standard_D2s_v5"
  admin_username      = var.admin_username

  disable_password_authentication = true

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.public_key
  }

  network_interface_ids = [
    data.azurerm_network_interface.nic.id
  ]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
}
