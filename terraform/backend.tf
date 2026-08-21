terraform {
  backend "azurerm" {
    resource_group_name   = "rg-tfstate"
    storage_account_name  = "stinterflowtfstate2026"
    container_name        = "tfstate"
    key                   = "interflow.tfsstate"
  }
}
