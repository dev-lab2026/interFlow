# InterFlow – Manuel d'installation et de déploiement DevOps sur Azure VM

---

# Page de garde

**Document technique de référence – Version 2.4 (Production Ready)**  
**Projet :** InterFlow – Plateforme Intelligente de Gestion d'Intercontrats, Matching de Missions & Valorisation des Compétences ESN  
**Public cible :** Ingénieurs DevOps, Administrateurs Systèmes & Réseaux, Développeurs Cloud Azure, Responsables de Production SI  
**Auteurs :** Équipe Architecture & DevOps InterFlow  
**Statut :** Validé pour Déploiement en Environnement Cloud Azure VM  
**Date d'édition :** 2026  

---

# Sommaire Général

- **Chapitre 1 : Présentation d'InterFlow**
  - 1.1 Contexte métier & Problématique des ESN
  - 1.2 Proposition de valeur & Fonctionnalités clés
  - 1.3 Stack technologique applicative & IA
  - 1.4 Rôles utilisateurs & Matrice des habilitations
- **Chapitre 2 : Architecture Globale du Système**
  - 2.1 Schéma synoptique d'architecture applicative
  - 2.2 Composants Backend (Node.js 20, Express, Drizzle ORM, Moteur ATS IA)
  - 2.3 Composants Frontend (React 18, Vite, Tailwind CSS, Lucide Icons)
  - 2.4 Modèle de persistance & Schéma relationnel PostgreSQL 16
  - 2.5 Intégration du moteur Google Gemini API (Analyse sémantique & Suggestions IA)
- **Chapitre 3 : Architecture Réseau & Infrastructure Azure**
  - 3.1 Topologie réseau (VNet, Subnets, Routage)
  - 3.2 Groupe de Sécurité Réseau (Network Security Group - NSG)
  - 3.3 Adressage IP statique & Attribution FQDN / Enregistrements DNS
  - 3.4 Ségrégation des flux et isolation des couches de données
- **Chapitre 4 : Provisionnement & Configuration de la VM Azure**
  - 4.1 Dimensionnement matériel (CPU, RAM, Disques SSD Managés)
  - 4.2 Déploiement via Azure CLI / Terraform / Bicep
  - 4.3 Déploiement pas-à-pas via le Portail Azure (Azure Portal)
  - 4.4 Gestion des paires de clés SSH & Accès distant sécurisé
- **Chapitre 5 : Initialisation & Sécurisation du Système Ubuntu Linux**
  - 5.1 Mise à jour des paquets et configuration initiale
  - 5.2 Création et gestion des comptes utilisateurs privilégiés (Sudoers)
  - 5.3 Optimisation mémoire (Swapfile 2 Go) & Paramètres noyau Linux (Sysctl)
  - 5.4 Durcissement SSH (Désactivation root & authentification par mot de passe)
  - 5.5 Configuration du pare-feu local UFW et du service anti-intrusion Fail2ban
- **Chapitre 6 : Gestion du Code Source avec Git et GitHub**
  - 6.1 Structure du référentiel Git InterFlow
  - 6.2 Stratégie de branches (GitFlow / Trunk-Based Development)
  - 6.3 Gestion des clés de déploiement (Deploy Keys) et accès SSH GitHub
  - 6.4 Gestion rigoureuse des variables d'environnement (.env.example vs .env)
- **Chapitre 7 : Conteneurisation avec Docker & Docker Compose**
  - 7.1 Conception du Dockerfile multi-étapes (Multi-stage build Node/Vite)
  - 7.2 Architecture du docker-compose.yml (Services App & PostgreSQL)
  - 7.3 Volumes de persistance & Réseaux isolés Docker
  - 7.4 Politiques de redémarrage et Healthchecks automatiques
- **Chapitre 8 : Pipeline CI/CD Automatisé avec GitHub Actions**
  - 8.1 Vue d'ensemble du workflow de livraison continue
  - 8.2 Définition complète du fichier .github/workflows/deploy.yml
  - 8.3 Configuration des Secrets GitHub (Secrets and Variables)
  - 8.4 Déclencheurs (Push, Pull Request, Dispatch manuel) & Tests de validation
- **Chapitre 9 : Déploiement Automatisé & Procédures d'Exploitation**
  - 9.1 Déploiement pas-à-pas du premier démarrage (Cold Start)
  - 9.2 Initialisation automatique du schéma SQL & Injection du compte Administrateur
  - 9.3 Déploiement de mises à jour sans rupture de service (Zero-Downtime)
  - 9.4 Scripts d'automatisation et tâches cron de maintenance
- **Chapitre 10 : Sécurité Avancée, SSL/TLS, Pare-feu & Gestion des Secrets**
  - 10.1 Configuration du Reverse Proxy Nginx
  - 10.2 Mise en place du certificat SSL/TLS Let's Encrypt avec Certbot
  - 10.3 En-têtes de sécurité HTTP (HSTS, CSP, X-Frame-Options, X-Content-Type)
  - 10.4 Politique de protection des clés d'API (Gemini) et des mots de passe SQL
- **Chapitre 11 : Monitoring, Gestion des Logs, Rollback & Dépannage**
  - 11.1 Surveillance des conteneurs (Docker stats, cgroups, healthcheck)
  - 11.2 Centralisation et analyse des journaux applicatifs et Nginx
  - 11.3 Procédure de Rollback instantané (Retour arrière en cas d'incident)
  - 11.4 Stratégie de sauvegarde automatisée PostgreSQL et Disaster Recovery
  - 11.5 Guide de résolution des incidents fréquents (Troubleshooting Matrix)

---

# Chapitre 1 : Présentation d'InterFlow

## 1.1 Contexte métier & Problématique des ESN

Dans les Entreprises de Services du Numérique (ESN) et cabinets de conseil technologique, la période d'**intercontrat** (ou "bench") représente l'un des postes de coût opérationnel les plus critiques. Un consultant non positionné sur une mission facturable engendre une perte financière directe tout en risquant une érosion de ses compétences si cette période n'est pas mise à profit de manière proactive.

Les défis majeurs rencontrés par les directions des opérations, responsables RH et business managers incluent :
- **Visibilité fragmentée** : Difficulté à cartographier en temps réel les compétences disponibles et le niveau d'employabilité des collaborateurs en intercontrat.
- **Lenteur du matching missions/profils** : Analyse manuelle et fastidieuse des CV face aux appels d'offres reçus quotidiennement, entraînant des retards dans les réponses commerciales.
- **Manque de plan de montée en compétences ciblé** : Absence de recommandations automatisées de formations certifiantes alignées sur la demande réelle du marché (Power Platform, Cloud Azure, Data, IA).
- **Formatage des CV chronophage** : Nécessité de reformater et d'anonymiser les dossiers de compétences au format standard ESN pour soumission aux clients grands comptes.

## 1.2 Proposition de valeur & Fonctionnalités clés

**InterFlow** est une plateforme unifiée et intelligente spécialement conçue pour transformer la gestion des intercontrats en un levier d'optimisation financière et humaine.

Principaux modules fonctionnels :
- **Tableau de Bord Décisionnel (Manager / RH / Consultant)** : Suivi en direct du taux d'intercontrat, du TJD moyen cible, de la durée moyenne d'inactivité et du score d'employabilité global.
- **Analyseur & Constructeur de Profil IA (ATS)** : Extraction instantanée depuis les fichiers CV (PDF/Word/Texte) des données d'identité, compétences clés, niveaux de séniorité et certifications, avec enregistrement direct dans la base de données relationnelle.
- **Moteur de Matching IA Missions/Consultants** : Algorithme comparatif pondérant l'adéquation technique, sectorielle et financière entre un profil et les opportunités commerciales ouvertes.
- **Générateur de Dossiers de Compétences ESN** : Restitution instantanée d'un CV normé, valorisant les réalisations probantes, les technologies maîtrisées et le niveau de certification.
- **Système de Recommandation de Formations & Certifications** : Identification des lacunes techniques et proposition de parcours Microsoft Learn / Azure ciblés augmentant le score d'employabilité.
- **Gestion des Utilisateurs & Rôles SI** : Contrôle d'accès basé sur les rôles (RBAC) garantissant la confidentialité des données consultants, financières et administratives.

## 1.3 Stack technologique applicative & IA

| Couche | Technologie retenue | Rôle dans l'application |
|---|---|---|
| **Runtime Serveur** | Node.js v20 LTS / TypeScript | Moteur d'exécution backend performant et typé |
| **Framework API** | Express.js | Routage RESTful, middlewares de sécurité, parsing de fichiers |
| **Interface Utilisateur** | React 18 / TypeScript / Vite | Single Page Application (SPA) ultra-réactive et modulaire |
| **Design & Styles** | Tailwind CSS v4 | Design system épuré, responsive, support du mode sombre/clair |
| **Base de Données** | PostgreSQL 16 | Système de gestion de base de données relationnelle ACID |
| **Accès aux Données** | PG Pool (node-postgres) | Gestion optimisée du pool de connexions SQL |
| **Intelligence Artificielle** | Google Gemini API (gemini-2.5-flash) | Extraction sémantique ATS, scoring de CV, génération de résumés |
| **Orchestration / DevOps** | Docker & Docker Compose | Conteneurisation standardisée et reproductible |
| **Reverse Proxy / SSL** | Nginx + Certbot Let's Encrypt | Chiffrement TLS/HTTPS, terminaison SSL, compression gzip |
| **Automatisation CI/CD** | GitHub Actions | Compilation, linting, tests et déploiement continu via SSH |

## 1.4 Rôles utilisateurs & Matrice des habilitations

InterFlow intègre une matrice de permissions granulaires :

```
┌─────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Fonctionnalité / Droit  │  Consultant  │   Manager    │  Équipe RH   │ Admin Global │
├─────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Mon Tableau de bord     │   Lecture    │   Lecture    │   Lecture    │   Lecture    │
│ Gestion / Upload de CV  │ Profil perso │ Tous profils │ Tous profils │ Tous profils │
│ Matching de Missions    │ Suggestions  │ Édition/Créa │ Consultation │ Total        │
│ Catalogue Formations    │ Inscription  │ Consultation │ Édition/Créa │ Total        │
│ Administration Users    │    Aucun     │    Aucun     │    Aucun     │ Total        │
│ Diagnostic PostgreSQL   │    Aucun     │    Aucun     │    Aucun     │ Total        │
└─────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

# Chapitre 2 : Architecture Globale du Système

## 2.1 Schéma synoptique d'architecture applicative

L'application repose sur une architecture moderne à deux niveaux, servie à travers un reverse proxy frontal et un conteneur applicatif monolithique modulaire :

```
[ Navigateurs Web Clients (Chrome / Edge / Safari / Firefox) ]
                             │ (HTTPS / Port 443)
                             ▼
               [ Nginx Reverse Proxy (Hôte Linux) ]
                 ├── Terminaison SSL (Let's Encrypt)
                 ├── Compression Gzip / Brotli
                 └── Sécurité Headers (HSTS, CSP)
                             │
                             │ (Proxy Pass http://127.0.0.1:3000)
                             ▼
             [ Conteneur Docker : interflow_app ]
      ┌─────────────────────────────────────────────────────────┐
      │  Express Web Server (Node.js 20 LTS)                   │
      │  ├── Static File Server (React 18 SPA compilée)         │
      │  ├── API Routes REST (/api/consultants, /api/missions)  │
      │  ├── Middleware Gemini AI (Extraction ATS, Scoring)     │
      │  └── Database Client (Pool SQL pg)                      │
      └─────────────────────────────────────────────────────────┘
                             │
            (Réseau Docker Interne / Port 5432)
                             │
                             ▼
             [ Conteneur Docker : interflow_db ]
      ┌─────────────────────────────────────────────────────────┐
      │  PostgreSQL 16 Engine                                  │
      │  ├── Tables : users, consultants, missions, formations  │
      │  └── Volume persistant : postgres_data (/var/lib/...)   │
      └─────────────────────────────────────────────────────────┘
```

## 2.2 Composants Backend

Le backend est implémenté en TypeScript et exécuté par Node.js 20. Il assure :
- **Le service de l'application cliente** : En production, les fichiers statiques HTML5/CSS3/JS générés par Vite dans `dist/` sont servis directement avec gestion des routes SPA (fallback vers `index.html`).
- **L'exposition des API REST sécurisées** : Endpoints CRUD pour les consultants, missions, formations, utilisateurs, diagnostics base de données.
- **La couche d'analyse de fichiers (Parsing CV)** : Réception des flux multipart (`multipart/form-data`) ou base64 de documents PDF/Word/Texte pour transmission au moteur d'IA.
- **L'initialisation dynamique de la base de données** : Exécution automatique des scripts DDL `CREATE TABLE IF NOT EXISTS` au démarrage du serveur, éliminant tout blocage au premier lancement.

## 2.3 Composants Frontend

Le frontend est structuré en composants React 18 utilisant TypeScript :
- **Architecture Single Page Application** avec gestion d'état centralisée et réactive.
- **Composants d'interface modulaires** : Modales d'ajout de profil consultant, modales de création de missions, explorateur de compétences, comparateur visuel d'employabilité.
- **Visualisations graphiques interactives** : Indicateurs de progression, jauges d'adéquation de compétences, badges de certification officiels Microsoft/Azure.
- **Gestion dynamique des thèmes** : Bascule fluide Mode Sombre / Mode Clair avec persistance de la préférence utilisateur.

## 2.4 Modèle de persistance & Schéma relationnel PostgreSQL 16

La base de données `interflow_db` est structurée autour de quatre tables relationnelles principales :

### Table `users` (Authentification et gestion des accès)
```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT 'AdminPass123!',
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Consultant',
  title TEXT,
  department TEXT,
  avatar TEXT,
  status TEXT DEFAULT 'Actif',
  last_login TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table `consultants` (Fiches de compétences et suivi d'intercontrat)
```sql
CREATE TABLE IF NOT EXISTS consultants (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT,
  manager TEXT,
  grade TEXT,
  title TEXT,
  date_debut_intercontrat TEXT,
  jours_intercontrat INTEGER DEFAULT 0,
  employabilite INTEGER DEFAULT 80,
  avatar TEXT,
  bio TEXT,
  tjd_souhaite INTEGER DEFAULT 600,
  cv_score INTEGER DEFAULT 80,
  cv_last_update TEXT,
  competences TEXT, -- JSON structuré (libelle, niveau, categorie)
  certifications TEXT, -- JSON structuré (code, nom, date, publisher)
  current_formations TEXT, -- JSON structuré (id, nom, status, progress)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table `missions` (Appels d'offres et opportunités commerciales)
```sql
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  client_logo TEXT,
  title TEXT NOT NULL,
  description TEXT,
  date_demarrage TEXT,
  duree_mois INTEGER DEFAULT 6,
  lieu TEXT,
  tjm INTEGER DEFAULT 650,
  status TEXT DEFAULT 'Ouverte',
  sector TEXT,
  competences_requises TEXT, -- JSON structuré des compétences cibles
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table `formations` (Catalogue de perfectionnement et certifications)
```sql
CREATE TABLE IF NOT EXISTS formations (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  categorie TEXT,
  duree_hours INTEGER DEFAULT 10,
  provider TEXT,
  certification_associee TEXT,
  priorite TEXT,
  impact_employabilite INTEGER DEFAULT 10,
  link_url TEXT,
  status TEXT DEFAULT 'A_faire',
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 2.5 Intégration du moteur Google Gemini API

L'analyse de CV et le matching sémantique exploitent le SDK officiel `@google/genai` côté serveur. La clé secrète `GEMINI_API_KEY` n'est jamais exposée au navigateur client.

Processus de traitement d'un CV :
1. Le client téléverse le document (PDF ou texte).
2. Le serveur injecte le contenu dans une invite de commande (prompt) système hautement calibrée demandant un schéma JSON strict.
3. Le modèle `gemini-2.5-flash` extrait de manière déterministe le prénom, le nom, le titre professionnel, les compétences pondérées, les certifications obtenues et les axes d'amélioration.
4. Les données sont retournées à l'interface et enregistrées dans PostgreSQL d'un simple clic ("Enregistrer dans PostgreSQL").

---

# Chapitre 3 : Architecture Réseau & Infrastructure Azure

## 3.1 Topologie réseau

Dans l'environnement Microsoft Azure, l'infrastructure est isolée au sein d'un Virtual Network (VNet) dédié afin d'assurer l'étanchéité des communications :

```
Azure Subscription
 └── Resource Group: rg-interflow-prod (West Europe)
      └── Virtual Network: vnet-interflow (10.0.0.0/16)
           └── Subnet: snet-interflow-app (10.0.1.0/24)
                ├── Network Interface: nic-interflow-vm
                │    ├── IP Privée Dynamique/Statique : 10.0.1.4
                │    └── IP Publique Standard : 20.x.x.x (avec FQDN DNS Azure)
                ├── Virtual Machine: vm-interflow-prod (Ubuntu 22.04 LTS)
                └── Network Security Group: nsg-interflow-prod
```

## 3.2 Groupe de Sécurité Réseau (Network Security Group - NSG)

Le NSG agit comme un pare-feu d'état au niveau de la couche réseau Azure (filtrage IP/Port). Les règles d'entrée (Inbound Rules) doivent respecter le principe de moindre privilège :

| Priorité | Nom de la règle | Port destination | Protocole | Source autorisée | Action | Justification |
|---|---|---|---|---|---|---|
| **1000** | `Allow-SSH-Admin` | `22` | TCP | IP Fixe Entreprise / VPN | **Allow** | Administration système sécurisée |
| **1010** | `Allow-HTTP` | `80` | TCP | `*` (Internet) | **Allow** | Challenge Let's Encrypt & Redirection HTTPS |
| **1020** | `Allow-HTTPS` | `443` | TCP | `*` (Internet) | **Allow** | Accès applicatif sécurisé pour les utilisateurs |
| **4000** | `Deny-All-Inbound` | `*` | Any | `*` | **Deny** | Blocage par défaut de tout autre trafic |

> **Sécurité renforcée :** Le port `5432` (PostgreSQL) et le port `3000` (Node.js) ne sont **JAMAIS** exposés sur Internet. Ils restent strictement cantonnés au réseau interne Docker `127.0.0.1`.

## 3.3 Adressage IP statique & Attribution FQDN / Enregistrements DNS

1. **IP Publique Azure Standard SKU** : Garantit une adresse IP publique persistante même après arrêt ou redémarrage de la machine virtuelle.
2. **FQDN Azure par défaut** : Possibilité de configurer un sous-domaine Azure du type :  
   `interflow-prod.westeurope.cloudapp.azure.com`
3. **Enregistrement DNS Personnalisé** :
   - Type : `A Record`
   - Hôte : `interflow.votre-entreprise.com`
   - Valeur : `<IP_PUBLIQUE_AZURE_VM>`
   - TTL : `300` (5 minutes)

## 3.4 Ségrégation des flux et isolation des couches de données

- **Trafic externe -> Hôte** : Uniquement sur les ports 80/443 vers le binaire Nginx.
- **Hôte -> Application** : Nginx communique via la boucle locale `127.0.0.1:3000`.
- **Application -> Base de Données** : Les conteneurs communiquent à travers le bridge réseau Docker privé `interflow_network`.

---

# Chapitre 4 : Provisionnement & Configuration de la VM Azure

## 4.1 Dimensionnement matériel

Pour un déploiement d'entreprise supportant de 10 à 500 utilisateurs simultanés avec des opérations d'analyse IA régulières :

- **Taille de VM recommandée** : `Standard_B2s` (2 vCPUs, 4 GiB RAM) pour les environnements de test / pré-production, ou `Standard_D2s_v5` (2 vCPUs, 8 GiB RAM, architecture moderne Intel Xeon Platinum) pour la production nominale.
- **Stockage Disque OS** : Disque SSD managé Premium de 30 Go à 64 Go (IOPS garantis, débit élevé).
- **Région Azure préconisée** : `France Central` (Paris) ou `West Europe` (Amsterdam) pour garantir la conformité RGPD et une latence réseau inférieure à 25 ms.

## 4.2 Déploiement via Azure CLI

L'exécution des commandes suivantes permet un provisionnement intégral en moins de 3 minutes :

```bash
# 1. Connexion à votre compte Azure
az login

# 2. Définition des variables de déploiement
RESOURCE_GROUP="rg-interflow-prod"
LOCATION="francecentral"
VM_NAME="vm-interflow-prod"
ADMIN_USER="azureuser"
DNS_LABEL="interflow-app-$(date +%s)"

# 3. Création du Groupe de Ressources
az group create --name $RESOURCE_GROUP --location $LOCATION

# 4. Création de l'IP Publique avec étiquette DNS
az network public-ip create \
  --resource-group $RESOURCE_GROUP \
  --name pip-interflow-prod \
  --allocation-method Static \
  --sku Standard \
  --dns-name $DNS_LABEL

# 5. Création du Virtual Network et du Subnet
az network vnet create \
  --resource-group $RESOURCE_GROUP \
  --name vnet-interflow \
  --address-prefix 10.0.0.0/16 \
  --subnet-name snet-interflow-app \
  --subnet-prefix 10.0.1.0/24

# 6. Création du Network Security Group (NSG)
az network nsg create \
  --resource-group $RESOURCE_GROUP \
  --name nsg-interflow-prod

# 7. Création des règles de sécurité NSG (SSH, HTTP, HTTPS)
az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name nsg-interflow-prod \
  --name Allow-SSH \
  --priority 1000 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 22

az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name nsg-interflow-prod \
  --name Allow-HTTP \
  --priority 1010 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 80

az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name nsg-interflow-prod \
  --name Allow-HTTPS \
  --priority 1020 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 443

# 8. Création de l'interface réseau (NIC)
az network nic create \
  --resource-group $RESOURCE_GROUP \
  --name nic-interflow-vm \
  --vnet-name vnet-interflow \
  --subnet snet-interflow-app \
  --network-security-group nsg-interflow-prod \
  --public-ip-address pip-interflow-prod

# 9. Création de la Machine Virtuelle Ubuntu 22.04 LTS avec clé SSH
az vm create \
  --resource-group $RESOURCE_GROUP \
  --name $VM_NAME \
  --nics nic-interflow-vm \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username $ADMIN_USER \
  --generate-ssh-keys \
  --os-disk-size-gb 32 \
  --storage-sku Premium_LRS

# 10. Affichage des adresses de connexion
az vm list-ip-addresses -g $RESOURCE_GROUP -n $VM_NAME --output table
```

## 4.3 Déploiement pas-à-pas via le Portail Azure

Si vous privilégiez l'interface graphique :
1. Rendez-vous sur le [Portail Azure](https://portal.azure.com).
2. Cliquez sur **Créer une ressource** > **Machine virtuelle**.
3. **Onglet Généralités** :
   - *Groupe de ressources* : Créer `rg-interflow-prod`.
   - *Nom de la machine virtuelle* : `vm-interflow-prod`.
   - *Région* : `(Europe) France Centre` ou `(Europe) Europe Ouest`.
   - *Image* : `Ubuntu Server 22.04 LTS - x64 Gen2`.
   - *Taille* : `Standard_B2s` ou `Standard_D2s_v5`.
   - *Type d'authentification* : `Clé publique SSH`.
   - *Nom d'utilisateur* : `azureuser`.
   - *Paire de clés SSH* : `Générer une nouvelle paire de clés` ou utiliser votre clé existante.
4. **Onglet Disques** : Sélectionner *Disque SSD Premium*.
5. **Onglet Réseau** :
   - Créer un VNet et un sous-réseau standard.
   - Attribuer une adresse IP publique.
   - *Groupe de sécurité réseau de base de la carte réseau* : Avancé (associer un NSG ouvrant les ports 22, 80, 443).
6. **Vérifier et créer** : Valider le déploiement et télécharger le fichier de clé privée `.pem`.

---

# Chapitre 5 : Initialisation & Sécurisation du Système Ubuntu Linux

## 5.1 Mise à jour des paquets et configuration initiale

Connectez-vous à la machine virtuelle en SSH :
```bash
ssh -i ~/.ssh/id_rsa_azure azureuser@<VOTRE_IP_PUBLIQUE_AZURE>
```

Appliquez immédiatement les correctifs de sécurité du noyau et des bibliothèques système :
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw fail2ban htop unzip jq ca-certificates gnupg lsb-release net-tools apt-transport-https
```

## 5.2 Création et gestion des comptes utilisateurs privilégiés

Assurez-vous que l'utilisateur `azureuser` dispose des privilèges `sudo` sans mot de passe pour les opérations d'automatisation CI/CD :
```bash
sudo usermod -aG sudo azureuser
```

## 5.3 Optimisation mémoire (Swapfile 2 Go)

Pour prévenir tout risque de saturation de la mémoire vive (Out-Of-Memory) lors des phases intensives de build Vite / Rollup, configurez un fichier de pagination swap de 2 Go :

```bash
# 1. Création du fichier de 2 Go
sudo fallocate -l 2G /swapfile

# 2. Restriction stricte des permissions (seul root peut lire)
sudo chmod 600 /swapfile

# 3. Formatage en espace Swap
sudo mkswap /swapfile

# 4. Activation immédiate du Swap
sudo swapon /swapfile

# 5. Rendre la configuration permanente au redémarrage
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 6. Optimisation de la réactivité mémoire (swappiness)
sudo sysctl vm.swappiness=15
echo 'vm.swappiness=15' | sudo tee -a /etc/sysctl.conf
```

## 5.4 Durcissement SSH

Éditez le fichier de configuration du démon SSH :
```bash
sudo nano /etc/ssh/sshd_config
```

Vérifiez et appliquez les directives de sécurité suivantes :
```ini
PermitRootLogin no
PasswordAuthentication no
X11Forwarding no
MaxAuthTries 4
ClientAliveInterval 300
ClientAliveCountMax 2
```

Redémarrez le service SSH pour appliquer les règles :
```bash
sudo systemctl restart ssh
```

## 5.5 Configuration du pare-feu local UFW et Fail2ban

Activez le pare-feu local `ufw` en complément du NSG Azure (stratégie de défense en profondeur) :

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH Access'
sudo ufw allow 80/tcp comment 'HTTP Web'
sudo ufw allow 443/tcp comment 'HTTPS Web'
sudo ufw --force enable
sudo ufw status verbose
```

Configuration de Fail2ban pour bannir automatiquement les adresses IP effectuant des tentatives répétées de connexion brute-force :

```bash
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

---

# Chapitre 6 : Gestion du Code Source avec Git et GitHub

## 6.1 Structure du référentiel Git InterFlow

Le projet InterFlow est structuré selon une arborescence claire séparant le serveur, le client React, la base de données et l'infrastructure DevOps :

```
interflow/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Pipeline CI/CD GitHub Actions
├── src/
│   ├── components/             # Composants React (GestionCV, Matching, RH...)
│   ├── db/                     # Définition du pool et connexion PostgreSQL
│   ├── App.tsx                 # Racine de l'application cliente
│   ├── main.tsx                # Point d'entrée DOM React
│   ├── types.ts                # Interfaces TypeScript unifiées
│   └── index.css               # Feuilles de style Tailwind CSS
├── Dockerfile                  # Construction de l'image de production
├── docker-compose.yml          # Orchestration des services App + PostgreSQL
├── server.ts                   # Serveur Express & API REST backend
├── vite.config.ts              # Configuration du bundler Vite
├── tsconfig.json               # Règles du compilateur TypeScript
├── package.json                # Dépendances NPM et scripts
└── .env.example                # Modèle des variables d'environnement
```

## 6.2 Stratégie de branches (GitFlow / Trunk-Based)

- **Branche `main`** : Branche de référence de production. Tout merge sur `main` déclenche le déploiement automatique vers la VM Azure.
- **Branches de fonctionnalités (`feature/*`)** : Développements isolés soumis à Pull Request avec validation automatique du linter et du build.

## 6.3 Configuration des clés de déploiement (Deploy Keys)

Pour permettre à la VM Azure de cloner et tirer les mises à jour du dépôt privé GitHub de manière sécurisée :

```bash
# 1. Génération d'une clé SSH dédiée sur la VM
ssh-keygen -t ed25519 -C "vm-azure-interflow" -f ~/.ssh/github_interflow -N ""

# 2. Affichage de la clé publique
cat ~/.ssh/github_interflow.pub
```

1. Rendez-vous sur votre dépôt GitHub : **Settings** > **Deploy keys** > **Add deploy key**.
2. Nommez la clé `Azure-VM-Production`, collez le contenu et cochez *Allow write access* uniquement si nécessaire (lecture seule recommandée).
3. Configurez la configuration SSH locale sur la VM :

```bash
cat << 'EOF' >> ~/.ssh/config
Host github.com
  IdentityFile ~/.ssh/github_interflow
  User git
EOF
chmod 600 ~/.ssh/config
```

## 6.4 Gestion rigoureuse des variables d'environnement

Le fichier `.env` de production ne doit **JAMAIS** être versionné dans Git. Seul `.env.example` est présent dans le référentiel.

Création du fichier d'environnement de production dans `/opt/interflow/.env` :

```bash
sudo mkdir -p /opt/interflow
sudo chown -R $USER:$USER /opt/interflow
cd /opt/interflow

cat << 'EOF' > /opt/interflow/.env
NODE_ENV=production
PORT=3000

# Clé API Google Gemini (obligatoire pour l'analyse IA de CV)
GEMINI_API_KEY=AIzaSyVotreCleSecreteGeminiProduction

# Configuration Base de données PostgreSQL
SQL_HOST=postgres
SQL_PORT=5432
SQL_DB_NAME=interflow_db
SQL_USER=interflow_admin
SQL_PASSWORD=ChangeMeSuperSecurePassword2026!

# URL publique de l'application
APP_URL=https://interflow.mondomaine.com
EOF

chmod 600 /opt/interflow/.env
```

---

# Chapitre 7 : Conteneurisation avec Docker & Docker Compose

## 7.1 Conception du Dockerfile multi-étapes (Multi-Stage Build)

Le `Dockerfile` à la racine du projet optimise la taille finale de l'image, réduit la surface d'attaque et compile à la fois les assets statiques frontend et le bundle serveur CommonJS :

```dockerfile
# Étape 1 : Construction et Compilation des Assets
FROM node:20-alpine AS builder
WORKDIR /app

# Copie des fichiers de définition des dépendances
COPY package*.json ./
RUN npm ci

# Copie de l'intégralité du code source
COPY . .

# Compilation Frontend (Vite) et Backend (Esbuild -> dist/server.cjs)
RUN npm run build

# Étape 2 : Image d'Exécution Minimale de Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Installation des bibliothèques nécessaires à la production
COPY package*.json ./
RUN npm ci --only=production

# Récupération des artefacts compilés depuis le builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./index.html

EXPOSE 3000

# Exécution du serveur compilé
CMD ["node", "dist/server.cjs"]
```

## 7.2 Architecture du docker-compose.yml

L'orchestration des conteneurs applicatif et base de données est centralisée dans `docker-compose.yml` :

```yaml
version: '3.8'

services:
  # Base de Données Relationnelle PostgreSQL 16
  postgres:
    image: postgres:16-alpine
    container_name: interflow_db
    restart: always
    environment:
      POSTGRES_DB: ${SQL_DB_NAME:-interflow_db}
      POSTGRES_USER: ${SQL_USER:-postgres}
      POSTGRES_PASSWORD: ${SQL_PASSWORD:-ChangeMeSuperSecurePassword123!}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${SQL_USER:-postgres} -d ${SQL_DB_NAME:-interflow_db}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - interflow_network

  # Application Web (Express + React + Gemini IA)
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: interflow_app
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      SQL_HOST: postgres
      SQL_PORT: 5432
      SQL_DB_NAME: ${SQL_DB_NAME:-interflow_db}
      SQL_USER: ${SQL_USER:-postgres}
      SQL_PASSWORD: ${SQL_PASSWORD:-ChangeMeSuperSecurePassword123!}
    networks:
      - interflow_network

volumes:
  postgres_data:
    driver: local

networks:
  interflow_network:
    driver: bridge
```

## 7.3 Installation de Docker Engine sur la VM

Exécutez sur la machine virtuelle :

```bash
# Suppression des versions obsolètes
sudo apt remove -y docker docker-engine docker.io containerd runc

# Ajout du dépôt officiel Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Autorisation de l'utilisateur standard à lancer Docker
sudo usermod -aG docker $USER
newgrp docker

# Activation du service au démarrage
sudo systemctl enable docker
sudo systemctl start docker
```

---

# Chapitre 8 : Pipeline CI/CD Automatisé avec GitHub Actions

## 8.1 Vue d'ensemble du workflow

Le pipeline CI/CD automatisé garantit que :
1. Chaque modification de code est validée syntaxiquement par le compilateur TypeScript (`tsc --noEmit`).
2. Les tests de build applicatifs sont exécutés avec succès dans l'environnement virtuel GitHub Runner.
3. Si et seulement si les tests réussissent, le Runner se connecte de façon sécurisée via SSH à la VM Azure pour mettre à jour le code et redémarrer les conteneurs sans interruption de service.

## 8.2 Définition du fichier .github/workflows/deploy.yml

Créez le fichier `.github/workflows/deploy.yml` :

```yaml
name: CI/CD Azure VM Deployment

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  test_and_build:
    name: 🔍 Lint & Test Compilation
    runs-on: ubuntu-latest
    steps:
      - name: 📥 Récupération du Code Source
        uses: actions/checkout@v4

      - name: 🟢 Configuration Node.js 20 LTS
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: 📦 Installation des dépendances NPM
        run: npm ci

      - name: 🧪 Validation TypeScript & Linter
        run: npm run lint

      - name: 🏗️ Test de Build de Production
        run: npm run build

  deploy_to_azure_vm:
    name: 🚀 Déploiement vers Azure VM
    needs: test_and_build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - name: 🔐 Exécution du Déploiement via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.AZURE_VM_IP }}
          username: ${{ secrets.AZURE_VM_USER }}
          key: ${{ secrets.AZURE_SSH_PRIVATE_KEY }}
          port: 22
          script_stop: true
          script: |
            cd /opt/interflow
            echo "📥 Récupération de la dernière version du code..."
            git pull origin main
            
            echo "🔨 Reconstruction et redémarrage des conteneurs..."
            docker compose build --no-cache app
            docker compose up -d --no-deps app
            
            echo "🧹 Nettoyage des anciennes images Docker inutilisées..."
            docker image prune -f
            
            echo "✅ Statut des services en production :"
            docker compose ps
```

## 8.3 Configuration des Secrets GitHub

Rendez-vous sur votre dépôt GitHub : **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.

Ajoutez les 3 variables secrètes obligatoires :

1. **`AZURE_VM_IP`** : L'adresse IP publique de votre VM Azure (ex: `20.199.45.123`).
2. **`AZURE_VM_USER`** : Le nom d'utilisateur SSH configuré (ex: `azureuser`).
3. **`AZURE_SSH_PRIVATE_KEY`** : La clé privée SSH au format OpenSSH (le contenu complet de votre fichier `id_rsa` débutant par `-----BEGIN OPENSSH PRIVATE KEY-----`).

---

# Chapitre 9 : Déploiement Automatisé & Procédures d'Exploitation

## 9.1 Déploiement initial pas-à-pas (Cold Start)

Sur la machine virtuelle Azure, exécutez la séquence d'initialisation :

```bash
# 1. Positionnement dans le dossier d'hébergement
cd /opt/interflow

# 2. Clonage du dépôt Git
git clone https://github.com/votre-organisation/interflow.git .

# 3. Vérification de la présence du fichier .env
ls -la .env

# 4. Lancement initial de la pile de conteneurs
docker compose up -d --build

# 5. Suivi des journaux d'initialisation
docker compose logs -f
```

## 9.2 Initialisation automatique du schéma SQL & Compte Admin

Au démarrage, le serveur Node.js exécute la routine `initDatabase()` dans `server.ts` :
- Création automatique des tables `users`, `consultants`, `missions`, `formations`.
- Création automatique du compte Administrateur par défaut dans PostgreSQL s'il n'existe pas :
  - **Identifiant** : `a.kershaw@interflow-esn.com`
  - **Mot de passe** : `AdminPass123!`
  - **Rôle** : `Admin` (Administrateur SI & Power Platform Tenant)

Test du bon fonctionnement du point de contrôle de santé :
```bash
curl -i http://127.0.0.1:3000/api/db/test
```
*Réponse attendue :*
```json
{
  "status": "success",
  "database": "interflow_db",
  "latencyMs": 4,
  "version": "PostgreSQL 16.2 on x86_64-pc-linux-musl",
  "tableCounts": {
    "users": 1,
    "consultants": 0,
    "missions": 0,
    "formations": 0
  }
}
```

## 9.3 Déploiement de mises à jour sans rupture de service

Pour mettre à jour l'application manuellement sans interrompre la base de données :

```bash
cd /opt/interflow
git pull origin main
docker compose build app
docker compose up -d --no-deps app
```

---

# Chapitre 10 : Sécurité Avancée, SSL/TLS, Pare-feu & Gestion des Secrets

## 10.1 Configuration du Reverse Proxy Nginx

Installez Nginx sur l'hôte Ubuntu :
```bash
sudo apt install -y nginx
```

Créez le fichier de configuration de l'application dans `/etc/nginx/sites-available/interflow.conf` :

```nginx
# Configuration du Reverse Proxy InterFlow ESN
server {
    listen 80;
    listen [::]:80;
    server_name interflow.votre-domaine.com; # Remplacer par votre FQDN

    # Taille maximale de téléversement (pour les CV PDF/DOCX volumineux)
    client_max_body_size 50M;

    # Masquage de la version de Nginx
    server_tokens off;

    # En-têtes de sécurité recommandés
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Routage vers l'application Express / React
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Gestion des WebSockets & Server-Sent Events (SSE)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # En-têtes d'identification du client d'origine
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts étendus pour l'analyse IA de CV volumineux
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;

        proxy_cache_bypass $http_upgrade;
    }
}
```

Activation de la configuration :
```bash
sudo ln -sf /etc/nginx/sites-available/interflow.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 10.2 Mise en place du certificat SSL/TLS Let's Encrypt avec Certbot

Générez et installez automatiquement le certificat SSL gratuit et valide internationalement :

```bash
sudo apt install -y certbot python3-certbot-nginx

# Génération du certificat et mise à jour automatique de la configuration Nginx en HTTPS
sudo certbot --nginx -d interflow.votre-domaine.com --non-interactive --agree-tos --email admin@votre-domaine.com --redirect
```

Vérification du renouvellement automatique (géré par systemd timer) :
```bash
sudo certbot renew --dry-run
```

---

# Chapitre 11 : Monitoring, Gestion des Logs, Rollback & Dépannage

## 11.1 Surveillance des conteneurs & Métriques

Surveillez la consommation CPU/RAM en direct :
```bash
docker stats --no-stream
```

Vérification de l'état de santé :
```bash
docker inspect --format='{{json .State.Health}}' interflow_app | jq
docker inspect --format='{{json .State.Health}}' interflow_db | jq
```

## 11.2 Centralisation et analyse des journaux applicatifs

```bash
# Journaux applicatifs Node.js / Express
docker logs -f interflow_app --tail 100

# Journaux PostgreSQL
docker logs -f interflow_db --tail 50

# Journaux du serveur Web Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 11.3 Procédure de Rollback instantané (Retour arrière)

En cas d'anomalie détectée après un déploiement, vous pouvez restaurer la version précédente en 30 secondes :

```bash
cd /opt/interflow

# 1. Identifier le commit stable précédent
git log --oneline -n 5

# 2. Revenir au commit sélectionné
git checkout <COMMIT_HASH_PRECEDENT>

# 3. Reconstruire et relancer le conteneur applicatif
docker compose build app
docker compose up -d --no-deps app

echo "✅ Rollback effectué avec succès."
```

## 11.4 Stratégie de sauvegarde automatisée PostgreSQL et Disaster Recovery

### Script de Sauvegarde Quotidienne
Créez le script `/usr/local/bin/backup-interflow-db.sh` :

```bash
sudo cat << 'EOF' > /usr/local/bin/backup-interflow-db.sh
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/interflow"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="$BACKUP_DIR/interflow_db_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

# Exécution du pg_dump dans le conteneur Docker
docker exec interflow_db pg_dump -U postgres interflow_db | gzip > $FILENAME

# Conservation des sauvegardes des 30 derniers jours
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +30 -delete

echo "[$DATE] Sauvegarde PostgreSQL effectuée avec succès : $FILENAME"
EOF

sudo chmod +x /usr/local/bin/backup-interflow-db.sh
```

### Planification Cron (Chaque nuit à 02h00)
```bash
sudo crontab -e
```
Ajoutez :
```cron
0 2 * * * /usr/local/bin/backup-interflow-db.sh >> /var/log/interflow_backup.log 2>&1
```

### Procédure de Restauration d'Urgence
```bash
gunzip < /var/backups/interflow/interflow_db_YYYY-MM-DD_HH-MM-SS.sql.gz | docker exec -i interflow_db psql -U postgres -d interflow_db
```

## 11.5 Guide de résolution des incidents fréquents (Troubleshooting Matrix)

| Symptôme / Erreur | Cause probable | Solution technique immédiate |
|---|---|---|
| `502 Bad Gateway` sur Nginx | Le conteneur `interflow_app` est arrêté ou redémarre en boucle | Vérifier `docker logs interflow_app`. Relancer avec `docker compose restart app`. |
| `ECONNREFUSED 127.0.0.1:5432` | La base PostgreSQL n'est pas prête ou le healthcheck a échoué | Vérifier `docker ps` et relancer avec `docker compose up -d postgres`. |
| `401 Unauthorized - Invalid Gemini API Key` | Clé API manquante ou invalide dans `/opt/interflow/.env` | Mettre à jour `GEMINI_API_KEY` dans `.env` et relancer `docker compose up -d app`. |
| `Out of Memory (OOM) Killed during build` | Mémoire RAM saturée pendant `npm run build` | Vérifier l'activation du Swap avec `swapon --show`. Ajouter 2 Go de Swapfile. |
| `Certbot SSL Challenge Failed` | Le port 80 est fermé dans le NSG Azure ou l'enregistrement DNS `A` est incorrect | Vérifier les règles NSG Azure et la propagation DNS avec `dig +short interflow.mondomaine.com`. |

---

**Fin du document technique – InterFlow Manuel d'installation et de déploiement DevOps sur Azure VM**
