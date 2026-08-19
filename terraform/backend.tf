terraform {
  backend "azurerm" {
    resource_group_name  = "rg-tfsstate"
    storage_account_name = "stinterflowtfsstate"
    container_name       = "tfsstate"
    key                  = "interflow.tfsstate"
  }
}
