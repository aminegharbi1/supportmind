# Workflows n8n

Importer les quatre fichiers dans n8n (`Workflows` → `Import from file`).

| Fichier | Rôle |
|---|---|
| `W1-support-complet.json` | workflow principal, 17 nœuds : IMAP → classement → agent → brouillon → validation → envoi |
| `T1-rechercher-documentation.json` | outil de l'agent : recherche plein texte dans la base de connaissances |
| `T2-historique-client.json` | outil de l'agent : les 5 derniers tickets du client |
| `T3-creer-escalade.json` | outil de l'agent : ouverture d'une escalade niveau 2 |

Les trois workflows `T*` doivent être **publiés** avant d'activer `W1` :
un workflow inactif n'est pas appelable comme outil.

Les identifiants (IMAP, SMTP, PostgreSQL, Ollama) ne sont pas inclus dans les
exports — seuls leurs noms y figurent. Il faut les recréer dans n8n.
