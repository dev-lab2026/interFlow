# InterFlow v8 — correction RBAC

Cette version corrige la séparation des rôles à la connexion.

## Rôles
- Admin -> Console Utilisateurs & Droits
- Manager -> Dashboard Manager
- RH -> Dashboard RH
- Consultant -> Dashboard Consultant

Le rôle est relu depuis PostgreSQL à chaque session et normalisé (`admin`, `manager`, `rh/hr`, `consultant`).
Le frontend ne conserve plus une vue précédente d'un autre rôle et interdit l'affichage de l'interface Admin aux non-Admins.

## Déploiement
Remplacer le dossier/projet par cette version puis reconstruire l'image :

```bash
docker compose down
docker compose build --no-cache interflow
docker compose up -d
```

Vérifier :
```bash
docker ps
docker logs --tail=100 interflow
```

Après déploiement, faire une déconnexion complète/reconnexion pour renouveler la session.
