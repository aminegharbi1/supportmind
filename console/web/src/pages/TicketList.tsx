import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Ticket } from "../api";
import { CATEGORIES, PRIORITES, formatDate, libelleStatut } from "../labels";

// Valeur de filtre spéciale pour les tickets dont le champ est vide (pas encore classés).
const VIDE = "__vide__";
const TOUS = "";

type Filtres = { statut: string; categorie: string; priorite: string };
const AUCUN_FILTRE: Filtres = { statut: TOUS, categorie: TOUS, priorite: TOUS };

function correspond(valeur: string | null, filtre: string): boolean {
  if (filtre === TOUS) return true;
  if (filtre === VIDE) return valeur === null;
  return valeur === filtre;
}

export default function TicketList() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtres, setFiltres] = useState<Filtres>(AUCUN_FILTRE);
  const [recentsDabord, setRecentsDabord] = useState(true);

  useEffect(() => {
    api.tickets().then(setTickets).catch((e: Error) => setErreur(e.message));
  }, []);

  // Les statuts de ticket ne sont pas énumérés dans le schéma : on propose ceux présents.
  const statuts = useMemo(
    () => [...new Set((tickets ?? []).map((t) => t.statut))].sort(),
    [tickets]
  );

  const visibles = useMemo(() => {
    const liste = (tickets ?? []).filter(
      (t) =>
        correspond(t.statut, filtres.statut) &&
        correspond(t.categorie, filtres.categorie) &&
        correspond(t.priorite, filtres.priorite)
    );
    const sens = recentsDabord ? -1 : 1;
    return liste.sort((a, b) => sens * (Date.parse(a.cree_le) - Date.parse(b.cree_le)));
  }, [tickets, filtres, recentsDabord]);

  const set = (k: keyof Filtres) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFiltres({ ...filtres, [k]: e.target.value });

  const filtreActif = Object.values(filtres).some((v) => v !== TOUS);
  const enAttente = (tickets ?? []).filter((t) => t.brouillon_en_attente).length;

  if (erreur) return <p className="erreur">Impossible de charger les tickets : {erreur}</p>;
  if (!tickets) return <p className="muted">Chargement…</p>;

  return (
    <>
      <div className="toolbar">
        <h1>Tickets</h1>
        <span className="muted">
          {visibles.length} / {tickets.length} · {enAttente} brouillon{enAttente > 1 ? "s" : ""} à valider
        </span>
        <div className="filtres">
          <label>
            Statut
            <select value={filtres.statut} onChange={set("statut")}>
              <option value={TOUS}>Tous</option>
              {statuts.map((s) => (
                <option key={s} value={s}>{libelleStatut(s)}</option>
              ))}
            </select>
          </label>
          <label>
            Catégorie
            <select value={filtres.categorie} onChange={set("categorie")}>
              <option value={TOUS}>Toutes</option>
              {Object.entries(CATEGORIES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
              <option value={VIDE}>Non classé</option>
            </select>
          </label>
          <label>
            Priorité
            <select value={filtres.priorite} onChange={set("priorite")}>
              <option value={TOUS}>Toutes</option>
              {Object.entries(PRIORITES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
              <option value={VIDE}>Non définie</option>
            </select>
          </label>
          {filtreActif && (
            <button className="lien" onClick={() => setFiltres(AUCUN_FILTRE)}>Réinitialiser</button>
          )}
        </div>
      </div>

      <table className="tickets">
        <thead>
          <tr>
            <th className="num">N°</th>
            <th>Sujet</th>
            <th>Client</th>
            <th>Catégorie</th>
            <th>Priorité</th>
            <th>Statut</th>
            <th>
              <button className="tri" onClick={() => setRecentsDabord(!recentsDabord)}>
                Date {recentsDabord ? "▼" : "▲"}
              </button>
            </th>
            <th>Brouillon</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((t) => {
            const ouvrir = () => navigate(`/tickets/${t.id}`);
            return (
              <tr
                key={t.id}
                tabIndex={0}
                onClick={ouvrir}
                onKeyDown={(e) => e.key === "Enter" && ouvrir()}
              >
                <td className="num">{t.id}</td>
                <td title={t.sujet}>{t.sujet}</td>
                <td className="email" title={t.client_email}>{t.client_email}</td>
                <td>
                  {t.categorie
                    ? CATEGORIES[t.categorie] ?? t.categorie
                    : <span className="muted">Non classé</span>}
                </td>
                <td className={t.priorite === "haute" ? "prio-haute" : undefined}>
                  {t.priorite ? PRIORITES[t.priorite] ?? t.priorite : <span className="muted">—</span>}
                </td>
                <td>{libelleStatut(t.statut)}</td>
                <td className="date">{formatDate(t.cree_le)}</td>
                <td>{t.brouillon_en_attente && <span className="attente">● À valider</span>}</td>
              </tr>
            );
          })}
          {visibles.length === 0 && (
            <tr className="vide">
              <td colSpan={8} className="muted">Aucun ticket ne correspond aux filtres.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
