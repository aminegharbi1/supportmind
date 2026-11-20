export const CATEGORIES: Record<string, string> = {
  authentification: "Authentification",
  facturation: "Facturation",
  panne: "Panne",
  commercial: "Commercial",
  information: "Information",
  autre: "Autre",
};

export function libelleCategorie(c: string | null): string {
  return c ? CATEGORIES[c] ?? c : "Non classé";
}

export const PRIORITES: Record<string, string> = {
  haute: "Haute",
  normale: "Normale",
  basse: "Basse",
};

const STATUTS: Record<string, string> = {
  nouveau: "Nouveau",
};

// Statuts de ticket non documentés : on affiche la valeur brute, lisiblement.
export function libelleStatut(s: string): string {
  return STATUTS[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export const STATUTS_BROUILLON: Record<string, string> = {
  a_valider: "À valider",
  approuve: "Approuvé — en attente d'envoi par n8n",
  rejete: "Refusé — escaladé",
  envoye: "Envoyé",
};

const fmtDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  return fmtDate.format(new Date(iso));
}

export function formatDuree(secondes: number | null): string {
  if (secondes === null) return "—";
  const min = Math.round(secondes / 60);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, "0")}`;
  return `${Math.floor(h / 24)} j ${h % 24} h`;
}
