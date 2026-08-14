# 🚀 Guide d'Installation & Déploiement Complet sur Machine Virtuelle Azure (DevOps Production)

Ce document détaille étape par étape la procédure pour déployer l'application **InterFlow** sur une **Machine Virtuelle Azure (Ubuntu Linux)** avec l'ensemble de la pile **DevOps** (Docker, Docker Compose, Nginx Reverse Proxy, SSL Let's Encrypt, Pare-feu UFW/NSG, CI/CD GitHub Actions, Supervision PM2/Docker, et Sauvegardes Automatisées PostgreSQL).

---

## 📑 Sommaire

1. [Architecture & Spécifications](#1-architecture--spécifications)
2. [Étape 1 : Provisionnement de la VM Azure & Réseau](#étape-1--provisionnement-de-la-vm-azure--réseau)
3. [Étape 2 : Initialisation & Sécurisation de l'OS (Ubuntu 22.04 / 24.04 LTS)](#étape-2--initialisation--sécurisation-de-los)
4. [Étape 3 : Installation de la Stack DevOps (Docker, Compose, Node, Git, Nginx, Certbot)](#étape-3--installation-de-la-stack-devops)
5. [Étape 4 : Déploiement de l'Application via Docker Compose (Recommandé)](#étape-4--déploiement-de-lapplication-via-docker-compose)
6. [Étape 5 : Alternative - Déploiement Natif avec PM2 & Systemd](#étape-5--alternative---déploiement-natif-avec-pm2--systemd)
7. [Étape 6 : Configuration du Reverse Proxy Nginx & Certificat SSL (HTTPS)](#étape-6--configuration-du-reverse-proxy-nginx--certificat-ssl-https)
8. [Étape 7 : Pipeline CI/CD Automatisé (GitHub Actions)](#étape-7--pipeline-cicd-automatisé-github-actions)
9. [Étape 8 : Monitoring, Logs & Alertes](#étape-8--monitoring-logs--alertes)
10. [Étape 9 : Stratégie de Sauvegarde Automatisée PostgreSQL & Disaster Recovery](#étape-9--stratégie-de-sauvegarde-automatisée-postgresql)
11. [Commandes de Maintenance & Dépannage Rapide](#commandes-de-maintenance--dépannage-rapide)

---

## 1. Architecture & Spécifications

```
                       [ Utilisateurs Web / Clients ]
                                     │ (HTTPS : 443)
                                     ▼
                      [ Azure Network Security Group ]
                                     │
                                     ▼
                   [ Nginx Reverse Proxy + SSL Let's Encrypt ]
                                     │
                 ┌───────────────────┴───────────────────┐
                 │ (Proxy Pass http://127.0.0.1:3000)    │
                 ▼                                       │
     [ Conteneur / Service App ]                         │
    (Node.js 20 + Express + React)                       │
                 │                                       │
                 │ (Port interne : 5432)                 │
                 ▼                                       │
      [ PostgreSQL 16 Database ]                         │
     (Persistance Volume Docker)                         │
                 │                                       │
                 ▼                                       ▼
     [ Tâches Cron Backup ]                  [ Gemini 2.5 Flash API ]
```

- **OS VM Azure** : Ubuntu 22.04 LTS ou Ubuntu 24.04 LTS
- **Taille Recommandée** : `Standard_B2s` (2 vCPU, 4 Go RAM) pour usage modéré ou `Standard_D2s_v5` (2 vCPU, 8 Go RAM) pour production
- **Disque** : 30 Go à 64 Go Premium SSD (LRS)
- **Base de données** : PostgreSQL 16 (Conteneurisée ou Azure Database for PostgreSQL)
- **Moteur d'IA** : Google Gemini API (`GEMINI_API_KEY`)

---

## Étape 1 : Provisionnement de la VM Azure & Réseau

### 1.1 Via Azure CLI ou Portail Azure
Depuis le portail Azure ou votre terminal Azure CLI :

```bash
# 1. Création du Groupe de Ressources
az group create --name rg-interflow-prod --location westeurope

# 2. Création de la VM Ubuntu avec clé SSH
az vm create \
  --resource-group rg-interflow-prod \
  --name vm-interflow-prod \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard

# 3. Récupération de l'adresse IP publique
az vm list-ip-addresses -g rg-interflow-prod -n vm-interflow-prod --output table
```

### 1.2 Configuration du Pare-Feu Azure (Network Security Group - NSG)
Ouvrez les ports requis dans le NSG associé à votre VM :
- **Port 22 (TCP)** : SSH (Autoriser uniquement votre IP fixe si possible)
- **Port 80 (TCP)** : HTTP (Ouvert à tous pour le challenge Let's Encrypt et la redirection HTTP->HTTPS)
- **Port 443 (TCP)** : HTTPS (Ouvert à tous pour le trafic chiffré web sécurisé)

```bash
# Ouverture des flux HTTP et HTTPS
az network nsg rule create -g rg-interflow-prod --nsg-name vm-interflow-prodNSG \
  --name Allow-HTTP --priority 1001 --direction Inbound --access Allow \
  --protocol Tcp --destination-port-ranges 80

az network nsg rule create -g rg-interflow-prod --nsg-name vm-interflow-prodNSG \
  --name Allow-HTTPS --priority 1002 --direction Inbound --access Allow \
  --protocol Tcp --destination-port-ranges 443
```

---

## Étape 2 : Initialisation & Sécurisation de l'OS

Connectez-vous en SSH à votre VM :
```bash
ssh azureuser@<VOTRE_IP_PUBLIQUE_AZURE>
```

### 2.1 Mises à jour du système & Utilitaires
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw fail2ban htop unzip jq ca-certificates gnupg lsb-release
```

### 2.2 Configuration du SWAP (2 Go)
Le Swap évite les erreurs OOM (Out Of Memory) lors de `npm run build` :
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2.3 Configuration du Pare-feu local (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

### 2.4 Sécurisation anti-brute-force (Fail2ban)
```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Étape 3 : Installation de la Stack DevOps

### 3.1 Installation de Docker Engine & Docker Compose Plugin
```bash
# Ajout de la clé GPG officielle Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Ajout du dépôt Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Autorisation de l'utilisateur azureuser sans sudo
sudo usermod -aG docker $USER
# Appliquer les nouveaux droits sans déconnexion
newgrp docker

# Vérification
docker --version
docker compose version
```

### 3.2 Installation de Nginx & Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Étape 4 : Déploiement de l'Application via Docker Compose

### 4.1 Clonage du Répertoire dans `/opt/interflow`
```bash
sudo mkdir -p /opt/interflow
sudo chown -R $USER:$USER /opt/interflow
cd /opt/interflow

# Clonez votre dépôt Git
git clone https://github.com/votre-compte/interflow.git .
```

### 4.2 Création du Fichier de Variables d'Environnement `.env`
Créez le fichier `.env` de production :
```bash
cat << 'EOF' > /opt/interflow/.env
NODE_ENV=production
PORT=3000

# Clé API Google Gemini (obligatoire pour l'analyse ATS de CV, matching et IA)
GEMINI_API_KEY=AIzaSyVotreCleSecreteGeminiIci

# Paramètres Base de Données PostgreSQL
SQL_HOST=postgres
SQL_PORT=5432
SQL_DB_NAME=interflow_db
SQL_USER=interflow_user
SQL_PASSWORD=MotDePasseTresSecurisePostgres2026!

# URL publique de l'application
APP_URL=https://interflow.mondomaine.com
EOF

chmod 600 /opt/interflow/.env
```

### 4.3 Vérification de la configuration Docker Compose
Le fichier `docker-compose.yml` est préconfiguré pour :
- Démarrer PostgreSQL 16 avec un volume persistant `postgres_data`
- Lancer le healthcheck de PostgreSQL
- Compiler et lancer l'application Node.js / Express sur le port local `127.0.0.1:3000`
- Configurer le redémarrage automatique en cas de panne (`restart: always`)

### 4.4 Lancement des Conteneurs
```bash
cd /opt/interflow
docker compose build --no-cache
docker compose up -d

# Vérifier l'état des conteneurs
docker compose ps
docker compose logs -f app
```

Testez l'accès local :
```bash
curl http://127.0.0.1:3000/api/health
# Réponse attendue : {"status":"ok"} ou diagnostic
```

---

## Étape 5 : Alternative - Déploiement Natif avec PM2 & Systemd

Si vous préférez exécuter l'application directement sur l'OS hôte sans conteneur Docker :

### 5.1 Installation de Node.js 20 LTS & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib
sudo npm install -g pm2
```

### 5.2 Configuration de PostgreSQL Local
```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE interflow_db;
CREATE USER interflow_user WITH ENCRYPTED PASSWORD 'MotDePasseTresSecurisePostgres2026!';
GRANT ALL PRIVILEGES ON DATABASE interflow_db TO interflow_user;
ALTER DATABASE interflow_db OWNER TO interflow_user;
\q
EOF
```

### 5.3 Build & Lancement PM2
```bash
cd /opt/interflow
npm ci
npm run build

# Démarrage avec PM2
pm2 start dist/server.cjs --name "interflow-app" --time
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
```

---

## Étape 6 : Configuration du Reverse Proxy Nginx & Certificat SSL (HTTPS)

### 6.1 Configuration du Virtual Host Nginx
Créez la configuration pour votre nom de domaine (ou l'IP publique) :

```bash
sudo nano /etc/nginx/sites-available/interflow.conf
```

Collez la configuration suivante (remplacez `interflow.mondomaine.com` par votre nom de domaine ou FQDN Azure) :

```nginx
server {
    listen 80;
    server_name interflow.mondomaine.com; # Remplacez par votre domaine ou IP

    # Taille max pour l'upload de CV (PDF, DOCX)
    client_max_body_size 50M;

    # Sécurité En-têtes HTTP
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Support des WebSockets & SSE
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # En-têtes Forwarded
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts pour les traitements IA lourds (extraction ATS de gros CV)
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;

        proxy_cache_bypass $http_upgrade;
    }
}
```

Activez le site et testez la configuration :
```bash
sudo ln -sf /etc/nginx/sites-available/interflow.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 6.2 Génération du Certificat SSL HTTPS Gratuit (Let's Encrypt)
Assurez-vous que l'enregistrement DNS `A` pointe vers l'adresse IP publique de votre VM Azure :

```bash
sudo certbot --nginx -d interflow.mondomaine.com --non-interactive --agree-tos --email admin@votre-domaine.com --redirect
```

Vérifiez le renouvellement automatique :
```bash
sudo certbot renew --dry-run
```

---

## Étape 7 : Pipeline CI/CD Automatisé (GitHub Actions)

Pour automatiser les déploiements à chaque `git push` sur la branche `main` :

Créez le fichier `.github/workflows/deploy.yml` dans votre dépôt :

```yaml
name: CI/CD Azure VM Deployment

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Deploy to Azure VM via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.AZURE_VM_IP }}
          username: ${{ secrets.AZURE_VM_USER }}
          key: ${{ secrets.AZURE_SSH_PRIVATE_KEY }}
          port: 22
          script: |
            cd /opt/interflow
            echo "Pulling latest changes..."
            git pull origin main
            echo "Rebuilding and restarting containers..."
            docker compose down
            docker compose up -d --build
            echo "Deployment successful!"
            docker compose ps
```

### Secrets GitHub à configurer (Settings > Secrets and variables > Actions) :
- `AZURE_VM_IP` : Adresse IP publique de votre VM Azure
- `AZURE_VM_USER` : Nom d'utilisateur SSH (ex: `azureuser`)
- `AZURE_SSH_PRIVATE_KEY` : Contenu complet de votre clé privée SSH (`id_rsa`)

---

## Étape 8 : Monitoring, Logs & Alertes

### 8.1 Consultation des logs en direct
```bash
# Logs applicatifs Docker
docker logs -f interflow_app --tail 100

# Logs base de données PostgreSQL
docker logs -f interflow_db --tail 50

# Logs d'accès et d'erreurs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 8.2 Surveillance des ressources en temps réel
```bash
docker stats
htop
df -h
```

### 8.3 Redémarrage automatique des conteneurs au reboot de la VM
Docker démarre automatiquement grâce au service `docker.service` et aux directives `restart: always` présentes dans `docker-compose.yml`.

---

## Étape 9 : Stratégie de Sauvegarde Automatisée PostgreSQL

### 9.1 Script de Sauvegarde Quotidienne
Créez le script `/usr/local/bin/backup-interflow-db.sh` :

```bash
sudo cat << 'EOF' > /usr/local/bin/backup-interflow-db.sh
#!/bin/bash
BACKUP_DIR="/var/backups/interflow"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="$BACKUP_DIR/interflow_db_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

# Exécution du pg_dump dans le conteneur Docker
docker exec interflow_db pg_dump -U interflow_user interflow_db | gzip > $FILENAME

# Suppression des sauvegardes de plus de 15 jours
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +15 -delete

echo "[$DATE] Sauvegarde PostgreSQL effectuée avec succès : $FILENAME"
EOF

sudo chmod +x /usr/local/bin/backup-interflow-db.sh
```

### 9.2 Planification Cron (Chaque nuit à 02h00)
```bash
sudo crontab -e
```
Ajoutez la ligne suivante :
```cron
0 2 * * * /usr/local/bin/backup-interflow-db.sh >> /var/log/interflow_backup.log 2>&1
```

### 9.3 Restauration d'une Sauvegarde en cas de besoin
```bash
gunzip < /var/backups/interflow/interflow_db_YYYY-MM-DD_HH-MM-SS.sql.gz | docker exec -i interflow_db psql -U interflow_user -d interflow_db
```

---

## Commandes de Maintenance & Dépannage Rapide

| Action | Commande |
|---|---|
| **Voir l'état des services** | `docker compose ps` |
| **Redémarrer l'application** | `docker compose restart app` |
| **Reconstruire après mise à jour** | `docker compose up -d --build` |
| **Arrêter l'ensemble** | `docker compose down` |
| **Tester le point de santé API** | `curl -i http://127.0.0.1:3000/api/health` |
| **Tester la connexion PostgreSQL** | `docker exec -it interflow_db psql -U interflow_user -d interflow_db -c '\dt'` |
| **Vérifier l'état de Nginx** | `sudo systemctl status nginx` |
| **Tester la syntaxe Nginx** | `sudo nginx -t` |
| **Renouveler SSL manuellement** | `sudo certbot renew` |

---

✅ **Votre application InterFlow est désormais installée et prête pour un fonctionnement continu en haute disponibilité sur Azure !**
