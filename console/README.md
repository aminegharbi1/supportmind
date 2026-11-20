# Console SupportMind

Interface des agents du support. Lit et écrit uniquement dans PostgreSQL ;
n'appelle jamais n8n.

## Lancer

API (port 8000) :

    cd api
    .venv\Scripts\python -m uvicorn main:app --reload --port 8000

Connexion par défaut : `host=localhost port=5432 dbname=supportmind user=supportmind password=changeme`
(surchargeable via la variable `DATABASE_URL`).

Front (port 5173, proxy `/api` vers 8000) :

    cd web
    npm run dev

Ouvrir http://localhost:5173
