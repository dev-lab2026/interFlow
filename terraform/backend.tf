terraform {
  backend "azurerm" {
    resource_group_name  = "rg-tfsstate"
    storage_account_name = "stinterflowtfstate01"
    container_name       = "tfstate"
    key                  = "interflow.tfstate"
  }
}
