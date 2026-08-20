# InterFlow – Déploiement Automatique sur Azure avec GitHub Actions, Terraform et Ansible

![Azure](https://img.shields.io/badge/Azure-VM-blue)
![Terraform](https://img.shields.io/badge/Terraform-IaC-purple)
![Ansible](https://img.shields.io/badge/Ansible-Automation-red)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-black)

## Présentation

Ce dépôt met en œuvre une chaîne DevOps complète permettant de déployer automatiquement **InterFlow** sur une machine virtuelle Azure.

À chaque `git push` sur la branche `main`, le pipeline :

1. Se connecte à Azure.
2. Crée une infrastructure avec Terraform.
3. Récupère automatiquement l'adresse IP publique de la VM.
4. Génère un inventaire Ansible.
5. Se connecte en SSH.
6. Installe Docker et Docker Compose.
7. Clone le dépôt GitHub sur la VM.
8. Lance l'application avec Docker Compose.

---

# Architecture

```text
GitHub
   │
   ▼
GitHub Actions
   │
   ▼
Azure Login
   │
   ▼
Terraform
   │
   ▼
Ubuntu VM
   │
   ▼
Ansible
   │
   ▼
Docker + Docker Compose
   │
   ▼
InterFlow
```

---

# Arborescence

```text
interflow/
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── terraform/
│   ├── provider.tf
│   ├── variables.tf
│   ├── main.tf
│   └── outputs.tf
│
├── ansible/
│   ├── inventory.ini
│   ├── playbook.yml
│   └── roles/
│       └── docker/
│           └── tasks/
│               └── main.yml
│
├── docker-compose.yml
└── README.md
```

---

# Prérequis

## Azure

Créer un Service Principal disposant des droits sur la souscription Azure.

```bash
az ad sp create-for-rbac \
  --name interflow-sp \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>
```

La commande retourne :

- Client ID
- Client Secret
- Tenant ID
- Subscription ID

Ces informations seront utilisées comme secrets GitHub.

---

## Clé SSH

Créer une paire de clés.

```bash
ssh-keygen -t rsa -b 4096 -f id_rsa
```

- `id_rsa` → GitHub Secret
- `id_rsa.pub` → Injectée automatiquement dans la VM.

---

# Configuration GitHub

## Secrets

Dans :

```
Repository
    Settings
        Secrets and Variables
            Actions
```

Créer les secrets suivants.

| Secret | Description |
|---------|------------|
| AZURE_CLIENT_ID | Client ID Azure |
| AZURE_CLIENT_SECRET | Secret Azure |
| AZURE_SUBSCRIPTION_ID | Subscription |
| AZURE_TENANT_ID | Tenant |
| SSH_PRIVATE_KEY | Clé privée SSH |

---

# Infrastructure Azure

Terraform crée automatiquement :

- Resource Group
- Virtual Network
- Subnet
- Network Security Group
- Public IP statique
- Interface réseau
- Machine virtuelle Ubuntu 24.04

Ports ouverts :

| Port | Usage |
|------|------|
|22|SSH|
|80|HTTP|
|443|HTTPS|

---

# Terraform

## Initialisation

```bash
cd terraform

terraform init
```

## Déploiement

```bash
terraform apply -auto-approve
```

## Sortie

```text
Outputs:

public_ip = 20.xxx.xxx.xxx
```

Cette adresse est récupérée automatiquement par GitHub Actions.

---

# Ansible

Une fois la VM créée, le pipeline génère :

```ini
[web]
20.xxx.xxx.xxx ansible_user=azureuser
```

Puis lance :

```bash
ansible-playbook \
-i ansible/inventory.ini \
--private-key ~/.ssh/id_rsa \
ansible/playbook.yml
```

---

# Ce que fait Ansible

Le playbook exécute automatiquement :

- Mise à jour Ubuntu
- Installation Docker
- Installation Docker Compose
- Installation Git
- Activation du service Docker
- Ajout de `azureuser` au groupe Docker
- Clonage du dépôt
- Déploiement Docker Compose

---

# Déploiement de l'application

Le dépôt est cloné dans :

```text
/opt/interflow
```

Puis :

```bash
cd /opt/interflow

docker compose pull

docker compose up -d --build
```

Les conteneurs sont lancés automatiquement.

---

# Pipeline GitHub Actions

Le workflow est situé dans :

```text
.github/workflows/deploy.yml
```

## Déroulement

| Étape | Description |
|--------|-------------|
| Checkout | Télécharge le dépôt |
| Azure Login | Connexion Azure |
| Terraform Init | Initialisation |
| Terraform Apply | Création VM |
| Get Public IP | Récupération IP |
| Inventory | Génération dynamique |
| Wait SSH | Attente de disponibilité |
| Install Ansible | Installation |
| Deploy | Déploiement |

---

# Exécution automatique

Chaque :

```bash
git push origin main
```

déclenche automatiquement le pipeline.

Exemple :

```text
Terraform Apply complete.

Outputs:

public_ip = 20.45.120.180
```

Puis :

```text
PLAY RECAP

20.45.120.180

ok=12
changed=10
failed=0
```

---

# Vérification

Connexion SSH :

```bash
ssh azureuser@20.45.120.180
```

Vérifier Docker :

```bash
docker ps
```

Exemple :

```text
frontend
backend
postgres
nginx
```

---

# Accès à l'application

Une fois le déploiement terminé :

```
http://<IP_PUBLIQUE>
```

Exemple :

```
http://20.45.120.180
```

---

# Mise à jour de l'application

Il suffit de pousser les modifications.

```bash
git add .

git commit -m "Update"

git push origin main
```

Le pipeline :

1. Recrée l'infrastructure si nécessaire.
2. Met à jour le dépôt sur la VM.
3. Reconstruit les images Docker.
4. Redémarre les conteneurs.

Aucune intervention manuelle n'est nécessaire.

---

# Bonnes pratiques

- Utiliser une IP publique statique.
- Stocker tous les secrets dans GitHub Secrets.
- Utiliser l'authentification SSH par clé.
- Exécuter Docker avec un utilisateur non root.
- Versionner Terraform et Ansible dans le même dépôt.
- Déployer uniquement depuis la branche `main`.

---

# Évolutions possibles

- HTTPS automatique avec Let's Encrypt.
- Nginx Proxy Manager ou Traefik.
- Azure Key Vault pour les secrets.
- Terraform Remote State.
- Déploiement Blue/Green.
- Monitoring avec Prometheus et Grafana.
- Centralisation des logs avec Loki.
- Sauvegardes automatiques de la base de données.
