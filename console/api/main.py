"""API de la console SupportMind.

Lecture/écriture directe dans PostgreSQL. N'appelle jamais n8n :
n8n relève lui-même les brouillons passés à 'approuve' et les envoie.
"""

import os
from contextlib import contextmanager

import psycopg
from fastapi import FastAPI, HTTPException
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict, Field

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "host=localhost port=5432 dbname=supportmind user=supportmind password=changeme",
)

# Statuts de ticket considérés comme clos (le schéma n'en documente aucun ;
# tout statut absent de cette liste compte comme « ouvert »).
STATUTS_CLOS = ("resolu", "ferme", "clos")

# Fuseau utilisé pour découper les journées du tableau de bord.
FUSEAU = "Europe/Paris"

app = FastAPI(title="SupportMind Console API")


@contextmanager
def db():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn


# --- Écran 1 : liste des tickets -------------------------------------------

@app.get("/api/tickets")
def list_tickets():
    """Tous les tickets (pas de pagination tant que < 500), du plus récent au plus ancien."""
    with db() as conn:
        return conn.execute(
            """
            SELECT t.id, t.sujet, c.email AS client_email, t.categorie, t.priorite,
                   t.statut, t.cree_le,
                   EXISTS (SELECT 1 FROM drafts d
                           WHERE d.ticket_id = t.id AND d.statut = 'a_valider')
                     AS brouillon_en_attente
            FROM tickets t
            JOIN customers c ON c.id = t.customer_id
            ORDER BY t.cree_le DESC
            """
        ).fetchall()


# --- Écran 2 : détail du ticket --------------------------------------------

@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: int):
    with db() as conn:
        ticket = conn.execute(
            """
            SELECT t.id, t.sujet, t.categorie, t.priorite, t.statut, t.confiance,
                   t.canal, t.cree_le, c.email AS client_email, c.nom AS client_nom
            FROM tickets t JOIN customers c ON c.id = t.customer_id
            WHERE t.id = %s
            """,
            (ticket_id,),
        ).fetchone()
        if not ticket:
            raise HTTPException(404, "Ticket introuvable")

        messages = conn.execute(
            """
            SELECT id, sens, expediteur, texte, recu_le
            FROM messages WHERE ticket_id = %s ORDER BY recu_le, id
            """,
            (ticket_id,),
        ).fetchall()

        # Brouillon affiché : celui à valider s'il existe, sinon le plus récent.
        brouillon = conn.execute(
            """
            SELECT id, texte, etaye, statut, modele, cree_le
            FROM drafts WHERE ticket_id = %s
            ORDER BY (statut = 'a_valider') DESC, cree_le DESC
            LIMIT 1
            """,
            (ticket_id,),
        ).fetchone()

        if brouillon:
            brouillon["citations"] = conn.execute(
                """
                SELECT ci.id, ci.rang, kd.titre, kd.version, kc.texte
                FROM citations ci
                JOIN knowledge_chunks kc ON kc.id = ci.chunk_id
                JOIN knowledge_documents kd ON kd.id = kc.document_id
                WHERE ci.draft_id = %s ORDER BY ci.rang
                """,
                (brouillon["id"],),
            ).fetchall()

        return {**ticket, "messages": messages, "brouillon": brouillon}


class Approbation(BaseModel):
    texte: str = Field(min_length=1)


class Refus(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    motif: str = Field(min_length=1)


@app.post("/api/drafts/{draft_id}/approuver")
def approuver(draft_id: int, corps: Approbation):
    """Enregistre le texte (éventuellement modifié) et passe le brouillon à 'approuve'.
    n8n se charge ensuite de l'envoi."""
    with db() as conn:
        row = conn.execute(
            """
            UPDATE drafts SET texte = %s, statut = 'approuve'
            WHERE id = %s AND statut = 'a_valider'
            RETURNING id, statut
            """,
            (corps.texte, draft_id),
        ).fetchone()
        if not row:
            raise HTTPException(409, "Ce brouillon n'est plus à valider.")
        return row


@app.post("/api/drafts/{draft_id}/refuser")
def refuser(draft_id: int, corps: Refus):
    """Crée une escalade avec le motif et passe le brouillon à 'rejete', en une transaction."""
    with db() as conn:
        draft = conn.execute(
            """
            UPDATE drafts SET statut = 'rejete'
            WHERE id = %s AND statut = 'a_valider'
            RETURNING id, org_id, ticket_id
            """,
            (draft_id,),
        ).fetchone()
        if not draft:
            raise HTTPException(409, "Ce brouillon n'est plus à valider.")
        esc = conn.execute(
            """
            INSERT INTO escalations (org_id, ticket_id, motif)
            VALUES (%s, %s, %s) RETURNING id
            """,
            (draft["org_id"], draft["ticket_id"], corps.motif.strip()),
        ).fetchone()
        return {"id": draft["id"], "statut": "rejete", "escalade_id": esc["id"]}


# --- Écran 3 : tableau de bord ---------------------------------------------

@app.get("/api/tableau-de-bord")
def tableau_de_bord():
    with db() as conn:
        compteurs = conn.execute(
            """
            SELECT
              (SELECT count(*) FROM tickets WHERE statut <> ALL(%s)) AS tickets_ouverts,
              (SELECT count(*) FROM drafts WHERE statut = 'a_valider') AS brouillons_en_attente,
              (SELECT count(*) FROM escalations WHERE statut = 'ouverte') AS escalades_ouvertes,
              (SELECT count(*) FROM drafts) AS brouillons_total,
              (SELECT count(*) FROM drafts WHERE etaye) AS brouillons_etayes
            """,
            (list(STATUTS_CLOS),),
        ).fetchone()

        volume = conn.execute(
            """
            WITH jours AS (
              SELECT generate_series(
                (now() AT TIME ZONE %(tz)s)::date - 29,
                (now() AT TIME ZONE %(tz)s)::date,
                interval '1 day')::date AS jour
            )
            SELECT j.jour, count(t.id) AS tickets
            FROM jours j
            LEFT JOIN tickets t ON (t.cree_le AT TIME ZONE %(tz)s)::date = j.jour
            GROUP BY j.jour ORDER BY j.jour
            """,
            {"tz": FUSEAU},
        ).fetchall()

        categories = conn.execute(
            """
            SELECT categorie, count(*) AS tickets
            FROM tickets GROUP BY categorie ORDER BY count(*) DESC, categorie
            """
        ).fetchall()

        # Délai = premier message entrant -> premier message sortant qui le suit.
        delais = conn.execute(
            """
            WITH d AS (
              SELECT t.categorie,
                     (SELECT min(s.recu_le) FROM messages s
                       WHERE s.ticket_id = t.id AND s.sens = 'sortant'
                         AND s.recu_le >= e.premier) - e.premier AS delai
              FROM tickets t
              JOIN LATERAL (SELECT min(recu_le) AS premier FROM messages
                            WHERE ticket_id = t.id AND sens = 'entrant') e ON true
              WHERE e.premier IS NOT NULL
            )
            SELECT categorie,
                   GROUPING(categorie) = 1 AS total,
                   count(*) AS tickets,
                   count(delai) AS repondus,
                   extract(epoch FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY delai))
                     AS mediane_secondes
            FROM d
            GROUP BY GROUPING SETS ((categorie), ())
            ORDER BY GROUPING(categorie), categorie NULLS LAST
            """
        ).fetchall()
        return {
            "compteurs": compteurs,
            "volume_par_jour": volume,
            "par_categorie": categories,
            "delais": delais,
        }
