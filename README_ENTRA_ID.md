# Microsoft Entra ID

Créer une App Registration dans Microsoft Entra ID, plateforme **Web**.

Redirect URI : `https://app.ton-domaine.fr/api/auth/entra/callback`

Renseigner dans `.env` : `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`, `ENTRA_ADMIN_EMAIL`.

L'authentification utilise le flux OAuth 2.0 Authorization Code via MSAL Node. Le compte indiqué par `ENTRA_ADMIN_EMAIL` est provisionné comme administrateur à sa première connexion. Les autres comptes doivent être précréés dans InterFlow par leur adresse email et reçoivent leur rôle depuis la base.
