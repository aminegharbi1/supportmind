import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Brouillon, TicketDetail as Detail } from "../api";
import {
  PRIORITES,
  STATUTS_BROUILLON,
  formatDate,
  libelleCategorie,
  libelleStatut,
} from "../labels";

export default function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<Detail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    if (!id) return;
    api.ticket(id).then(setTicket).catch((e: Error) => setErreur(e.message));
  }, [id]);

  useEffect(charger, [charger]);

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!ticket) return <p className="muted">Chargement…</p>;

  return (
    <>
      <div className="fil">
        <Link to="/">← Tickets</Link>
      </div>
      <div className="entete-ticket">
        <h1>
          <span className="muted">#{ticket.id}</span> {ticket.sujet}
        </h1>
        <dl className="meta">
          <dt>Client</dt>
          <dd>{ticket.client_nom ? `${ticket.client_nom} · ` : ""}{ticket.client_email}</dd>
          <dt>Catégorie</dt>
          <dd>
            {libelleCategorie(ticket.categorie)}
            {ticket.confiance !== null && (
              <span className="muted"> ({Math.round(ticket.confiance * 100)} %)</span>
            )}
          </dd>
          <dt>Priorité</dt>
          <dd className={ticket.priorite === "haute" ? "prio-haute" : undefined}>
            {ticket.priorite ? PRIORITES[ticket.priorite] ?? ticket.priorite : "—"}
          </dd>
          <dt>Statut</dt>
          <dd>{libelleStatut(ticket.statut)}</dd>
          <dt>Reçu le</dt>
          <dd>{formatDate(ticket.cree_le)}</dd>
        </dl>
      </div>

      <div className="detail-grille">
        <section>
          <h2>Messages ({ticket.messages.length})</h2>
          {ticket.messages.length === 0 && <p className="muted">Aucun message.</p>}
          {ticket.messages.map((m) => (
            <article key={m.id} className={`message ${m.sens}`}>
              <header>
                <span className="sens">{m.sens === "entrant" ? "Reçu" : "Envoyé"}</span>
                <span>{m.expediteur ?? "—"}</span>
                <span className="muted">{formatDate(m.recu_le)}</span>
              </header>
              <div className="texte">
                {m.texte?.replace(/\r/g, "").trim() || <span className="muted">(message vide)</span>}
              </div>
            </article>
          ))}
        </section>

        <section>
          <h2>Brouillon de réponse</h2>
          {ticket.brouillon ? (
            <PanneauBrouillon key={ticket.brouillon.id} brouillon={ticket.brouillon} onChange={charger} />
          ) : (
            <p className="muted">Aucun brouillon pour ce ticket : réponse à rédiger manuellement.</p>
          )}
        </section>
      </div>
    </>
  );
}

function PanneauBrouillon({ brouillon, onChange }: { brouillon: Brouillon; onChange: () => void }) {
  const [texte, setTexte] = useState(brouillon.texte);
  const [refusEnCours, setRefusEnCours] = useState(false);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const nb = brouillon.citations.length;
  // « étayé » n'est fiable que s'il y a réellement des citations derrière.
  const etaye = brouillon.etaye && nb > 0;
  const modifiable = brouillon.statut === "a_valider";
  const modifie = texte !== brouillon.texte;

  async function agir(action: () => Promise<unknown>) {
    setEnvoi(true);
    setErreur(null);
    try {
      await action();
      onChange();
    } catch (e) {
      setErreur((e as Error).message);
      setEnvoi(false);
    }
  }

  function approuver() {
    if (!texte.trim()) return setErreur("Le texte de la réponse est vide.");
    if (!etaye && !confirm("Ce brouillon n'est étayé par aucune source.\nConfirmer l'approbation et l'envoi au client ?")) return;
    agir(() => api.approuver(brouillon.id, texte));
  }

  function refuser() {
    if (!motif.trim()) return setErreur("Le motif du refus est obligatoire.");
    agir(() => api.refuser(brouillon.id, motif));
  }

  return (
    <div className="brouillon">
      {etaye ? (
        <div className="bandeau etaye">✓ Étayé par {nb} source{nb > 1 ? "s" : ""}</div>
      ) : (
        <div className="bandeau non-etaye">NON ÉTAYÉ — à traiter manuellement</div>
      )}

      <div className="brouillon-meta muted">
        {STATUTS_BROUILLON[brouillon.statut] ?? brouillon.statut} · généré le {formatDate(brouillon.cree_le)}
        {brouillon.modele && ` · ${brouillon.modele}`}
      </div>

      {nb > 0 && (
        <div className="citations">
          <h3>Sources citées</h3>
          {brouillon.citations.map((c) => (
            <details key={c.id}>
              <summary>
                <span className="muted">[{c.rang}]</span> {c.titre} <span className="muted">· v{c.version}</span>
              </summary>
              <blockquote>{c.texte}</blockquote>
            </details>
          ))}
        </div>
      )}

      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        readOnly={!modifiable}
        rows={14}
        aria-label="Texte de la réponse"
      />
      {modifiable && modifie && (
        <div className="muted petit">
          Modifié ·{" "}
          <button className="lien" onClick={() => setTexte(brouillon.texte)}>revenir au texte proposé</button>
        </div>
      )}

      {erreur && <p className="erreur">{erreur}</p>}

      {modifiable && !refusEnCours && (
        <div className="actions">
          <button className="btn primaire" disabled={envoi} onClick={approuver}>APPROUVER</button>
          <button className="btn" disabled={envoi} onClick={() => setRefusEnCours(true)}>REFUSER</button>
        </div>
      )}

      {modifiable && refusEnCours && (
        <div className="refus">
          <label htmlFor="motif">Motif du refus (une escalade sera créée)</label>
          <textarea
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Ex. : réponse inexacte, demande hors périmètre, client à rappeler…"
          />
          <div className="actions">
            <button className="btn" disabled={envoi} onClick={refuser}>Confirmer le refus</button>
            <button className="lien" disabled={envoi} onClick={() => { setRefusEnCours(false); setErreur(null); }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
