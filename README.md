# SupportMind

Système de support client assisté par IA. Un email arrive, il devient un ticket
classé, un agent LLM rédige une réponse appuyée sur la documentation interne,
un humain valide en un clic, et la réponse part dans le même fil de discussion.

Tout tourne en local : n8n pour l'orchestration, PostgreSQL pour les données,
Ollama (`llama3.2`) pour le modèle. Aucune API payante, aucune donnée client
qui sort de la machine.


---

## Le flux complet

```
Email client (IMAP)
      │
      ▼
 Normaliser ──────── empreinte du message, extraction de l'expéditeur,
      │              découpage de la citation, récupération des en-têtes
      │              Message-ID / In-Reply-To / References
      ▼
 Classer ─────────── 5 catégories par règles (authentification, facturation,
      │              panne, commercial, information) + priorité + score de
      │              confiance ; en dessous de 0,6 le ticket est marqué « à revoir »
      ▼
 Enregistrer ─────── une seule requête SQL : dédoublonnage par provider_id,
      │              rattachement au ticket parent via les References,
      │              création du client / du ticket / du message
      ▼
 Agent de support ── llama3.2 + 3 outils (voir plus bas)
      │
      ▼
 Brouillon ───────── enregistré avec ses citations ; la base recalcule
      │              elle-même si le brouillon est « étayé »
      ▼
 Demander validation ─ email avec deux boutons, le workflow se met en pause
      │
      ├── Approuvé ──► réponse envoyée au client dans le même fil
      └── Refusé ────► escalade créée en base + technicien prévenu
```

## Les agents et leurs outils

Le workflow principal contient **un agent** (nœud AI Agent de n8n) branché sur
Ollama, qui décide lui-même quels outils appeler. Chaque outil est un workflow
n8n séparé, publié et appelable :

| Outil | Workflow | Ce qu'il fait |
|---|---|---|
| `rechercher_documentation` | `T1` | recherche plein texte française dans la base de connaissances, renvoie les 3 meilleurs extraits avec leur `chunk_id` |
| `historique_client` | `T2` | les 5 derniers tickets de ce client |
| `creer_escalade` | `T3` | ouvre une escalade vers le niveau 2 quand l'agent ne sait pas répondre |

## Le point le plus intéressant : empêcher l'invention de sources

Première version : l'agent renvoyait les `chunk_id` des fiches qu'il disait
avoir utilisées, et le workflow les insérait dans la table `citations`. Un
modèle local invente volontiers des identifiants — la base a répondu par une
violation de clé étrangère (`chunk_id = 23` n'existait pas).

La correction ne se fait pas dans le prompt mais dans le SQL. Les
identifiants annoncés par le modèle sont d'abord croisés avec les vrais
extraits, et c'est la base qui décide si le brouillon est étayé :

```sql
with valides as (
  select t.chunk_id, t.ord
  from unnest($3::bigint[]) with ordinality as t(chunk_id, ord)
  join knowledge_chunks k on k.id = t.chunk_id
),
d as (
  insert into drafts (ticket_id, texte, etaye, modele)
  values ($1::bigint, $2::text, (select count(*) > 0 from valides), 'agent-ollama-v1')
  returning id, etaye
)
...
```

Un identifiant inventé est simplement écarté : le brouillon existe toujours,
mais il est marqué comme non étayé et l'agent du support le voit dans la console.

## Recherche documentaire

Pas d'embeddings : la recherche repose sur la recherche plein texte de
PostgreSQL avec le dictionnaire français, une colonne `tsvector` générée et un
index GIN.

```sql
recherche tsvector generated always as (to_tsvector('french', texte)) stored
```

C'est suffisant pour une base de connaissances de quelques dizaines de fiches,
et ça évite de faire tourner un modèle d'embedding en plus. L'image Docker est
déjà `pgvector/pgvector:pg17`, le passage aux vecteurs est donc possible sans
changer d'infrastructure.

## Fils de discussion

Le rattachement d'une réponse à son ticket ne se fait **jamais** par le sujet
de l'email, qui n'est pas fiable. Il se fait par les en-têtes `Message-ID`,
`In-Reply-To` et `References`, stockés à l'arrivée et recherchés dans
`messages.provider_id`.

---

## Contenu du dépôt

```
compose.yml                   n8n + PostgreSQL
sql/01_schema.sql             customers, tickets, messages, escalations
sql/02_knowledge_base.sql     knowledge_documents, knowledge_chunks, drafts,
                              citations + un jeu de 5 fiches de démonstration
workflows/                    les 4 workflows n8n, à importer tels quels
console/api/                  API FastAPI (lecture/écriture PostgreSQL)
console/web/                  console agent en React + Vite
```

## Lancer le projet

```bash
cp .env.example .env
docker compose up -d
```

Puis appliquer le schéma :

```bash
docker compose exec -T db psql -U supportmind -d supportmind < sql/01_schema.sql
docker compose exec -T db psql -U supportmind -d supportmind < sql/02_knowledge_base.sql
```

Dans n8n (`http://localhost:5678`) :

1. importer les 4 fichiers de `workflows/`
2. créer les identifiants attendus : `Postgres account` (host `db`),
   `IMAP account`, `SMTP Gmail`, `Ollama local`
   (base `http://host.docker.internal:11434`)
3. **publier les trois workflows `T1`, `T2`, `T3`** — un workflow non publié
   n'est pas appelable comme outil, l'agent tourne alors en boucle jusqu'à sa
   limite d'itérations
4. activer `W1`

Côté Ollama : `ollama pull llama3.2`, et autoriser l'accès réseau pour que le
conteneur n8n puisse l'atteindre.

La console :

```bash
cd console/api && python -m uvicorn main:app --port 8000
cd console/web && npm install && npm run dev
```

## Ce qui reste à faire

Le cycle complet fonctionne de bout en bout, mais la console a mis en évidence
trois défauts :

- les newsletters et les expéditeurs `no-reply` deviennent des tickets ;
  il faut filtrer sur l'en-tête `List-Unsubscribe` dans `Normaliser`
- les réponses envoyées ne sont pas réinsérées dans `messages` avec
  `sens = 'sortant'`, donc le délai de réponse médian ne se calcule pas
- `rechercher_documentation` échoue par intermittence, ce qui produit des
  brouillons non étayés

À faire ensuite : un jeu d'évaluation de 20 emails de test avec un score, un
workflow d'erreur avec table de rebut, et le canal formulaire web prévu au
cahier des charges.

## Pile technique

n8n · PostgreSQL 17 · Ollama (llama3.2) · Docker Compose · FastAPI · React ·
Vite · TypeScript

## Licence

MIT
