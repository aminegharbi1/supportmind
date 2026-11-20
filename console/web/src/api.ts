// Seul point d'accès aux données : l'API FastAPI (proxy Vite sur /api).

export type Ticket = {
  id: number;
  sujet: string;
  client_email: string;
  categorie: string | null;
  priorite: string | null;
  statut: string;
  cree_le: string;
  brouillon_en_attente: boolean;
};

export type Message = {
  id: number;
  sens: "entrant" | "sortant";
  expediteur: string | null;
  texte: string | null;
  recu_le: string;
};

export type Citation = {
  id: number;
  rang: number;
  titre: string;
  version: number;
  texte: string;
};

export type StatutBrouillon = "a_valider" | "approuve" | "rejete" | "envoye";

export type Brouillon = {
  id: number;
  texte: string;
  etaye: boolean;
  statut: StatutBrouillon;
  modele: string | null;
  cree_le: string;
  citations: Citation[];
};

export type TicketDetail = {
  id: number;
  sujet: string;
  categorie: string | null;
  priorite: string | null;
  statut: string;
  confiance: number | null;
  canal: string;
  cree_le: string;
  client_email: string;
  client_nom: string | null;
  messages: Message[];
  brouillon: Brouillon | null;
};

export type TableauDeBord = {
  compteurs: {
    tickets_ouverts: number;
    brouillons_en_attente: number;
    escalades_ouvertes: number;
    brouillons_total: number;
    brouillons_etayes: number;
  };
  volume_par_jour: { jour: string; tickets: number }[];
  par_categorie: { categorie: string | null; tickets: number }[];
  delais: {
    categorie: string | null;
    total: boolean;
    tickets: number;
    repondus: number;
    mediane_secondes: number | null;
  }[];
};

async function requete<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const corps = await res.json();
      if (typeof corps.detail === "string") detail = corps.detail;
    } catch {
      /* corps non JSON */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, corps: unknown) =>
  requete<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });

export const api = {
  tickets: () => requete<Ticket[]>("/api/tickets"),
  ticket: (id: string) => requete<TicketDetail>(`/api/tickets/${id}`),
  approuver: (draftId: number, texte: string) =>
    post<{ id: number; statut: string }>(`/api/drafts/${draftId}/approuver`, { texte }),
  refuser: (draftId: number, motif: string) =>
    post<{ id: number; statut: string; escalade_id: number }>(`/api/drafts/${draftId}/refuser`, { motif }),
  tableauDeBord: () => requete<TableauDeBord>("/api/tableau-de-bord"),
};
