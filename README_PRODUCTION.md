# InterFlow — Production Azure

Cette version durcit l'authentification, protège les API, retire l'exposition PostgreSQL, prépare l'application pour Nginx Proxy Manager et sépare l'infrastructure du trafic applicatif.

## Pré-requis Azure

1. Un abonnement Azure.
2. Une identité GitHub Actions configurée avec **OIDC / Federated Credentials**.
3. Un backend Terraform Azure Blob déjà créé :
   - Resource group : `rg-tfsstate`
   - Storage account : `stinterflowtfstate01`
   - Container : `tfstate`
4. Un domaine DNS pointant vers l'IP publique de la VM et Nginx Proxy Manager déjà installé sur le réseau Docker `shared_network`.
6. Un mot de passe administrateur initial de 12 caractères minimum.

## Secrets GitHub `production`

Configurer dans l'environnement GitHub `production` :

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `SSH_PRIVATE_KEY`
- `SSH_SOURCE_CIDR` — IP/CIDR du VPN ou réseau d'administration autorisé en SSH
- `SESSION_SECRET` — secret aléatoire d'au moins 32 caractères
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SQL_PASSWORD`

## Déploiement

Un push sur `main` déclenche :

1. installation des dépendances ;
2. vérification TypeScript + build ;
3. connexion Azure par OIDC ;
4. Terraform ;
5. installation Docker sur la VM ;
6. déploiement Docker Compose ;
7. initialisation automatique du schéma PostgreSQL par l’application ;
8. création de l'administrateur initial si absent.

## Sécurité

- Authentification backend avec cookie `HttpOnly`, `Secure` en production et `SameSite=Lax`.
- Hash des mots de passe avec `scrypt` via Node `crypto`.
- RBAC serveur pour les routes sensibles.
- PostgreSQL uniquement sur le réseau Docker interne.
- Reverse proxy HTTPS assuré par Nginx Proxy Manager sur `shared_network`.
- Limitation de débit sur login et endpoints IA.
- Secrets hors dépôt.
- HSTS et headers de sécurité.
- SSH restreint par `SSH_SOURCE_CIDR`.

## Vérification post-déploiement

```bash
BASE_URL=http://127.0.0.1:3003 ./scripts/smoke.sh
```

## Première connexion

L'administrateur initial est créé depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Ne jamais mettre ces valeurs dans le code ou dans `.env` versionné. Après le premier accès, utiliser un gestionnaire de secrets et faire tourner le mot de passe initial.


## Nginx Proxy Manager

Nginx Proxy Manager doit être connecté au réseau Docker externe `shared_network`.
Le Proxy Host doit cibler :

- Scheme : `http`
- Forward Hostname / IP : `interflow`
- Forward Port : `3003`

Caddy n'est plus utilisé par ce projet.

## Microsoft Entra ID

L'application utilise MSAL Node avec le flux Authorization Code côté serveur. Pour une inscription mono-tenant, configurez une plateforme **Web** dans Microsoft Entra et ajoutez exactement :

`https://interflow.tfsn.duckdns.org/api/auth/entra/callback`

Variables requises : `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`, `ENTRA_ADMIN_EMAIL`.

`ENTRA_ADMIN_EMAIL` correspond au compte Entra qui reçoit automatiquement le rôle `Admin` lors de sa première connexion.

Un accès d'urgence local reste disponible avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.


## GitHub Secrets
Utiliser un **seul secret GitHub `INTERFLOW_ENV`** contenant l'ensemble du fichier `.env`. Le workflow le recrée automatiquement sur la VM.

## Workflows
- `deploy.yml` : CI/CD complet.
- `destroy.yml` : destruction contrôlée de l'infrastructure Azure.
