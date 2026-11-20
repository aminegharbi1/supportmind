import { useEffect, useState } from "react";
import { api, TableauDeBord } from "../api";
import { formatDuree, libelleCategorie } from "../labels";

const fmtJour = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
const fmtJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
// Les jours arrivent au format AAAA-MM-JJ : on les lit en heure locale.
const jourLocal = (j: string) => new Date(`${j}T00:00:00`);

export default function Dashboard() {
  const [donnees, setDonnees] = useState<TableauDeBord | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.tableauDeBord().then(setDonnees).catch((e: Error) => setErreur(e.message));
  }, []);

  if (erreur) return <p className="erreur">Impossible de charger le tableau de bord : {erreur}</p>;
  if (!donnees) return <p className="muted">Chargement…</p>;

  const c = donnees.compteurs;
  const part = c.brouillons_total ? Math.round((100 * c.brouillons_etayes) / c.brouillons_total) : null;

  return (
    <>
      <div className="toolbar"><h1>Tableau de bord</h1></div>

      <div className="tuiles">
        <Tuile libelle="Tickets ouverts" valeur={c.tickets_ouverts} />
        <Tuile libelle="Brouillons à valider" valeur={c.brouillons_en_attente} />
        <Tuile libelle="Escalades ouvertes" valeur={c.escalades_ouvertes} />
        <Tuile
          libelle="Brouillons étayés"
          valeur={part === null ? "—" : `${part} %`}
          note={`${c.brouillons_etayes} sur ${c.brouillons_total}`}
        />
      </div>

      <div className="grille-graphes">
        <section className="carte large">
          <h2>Tickets reçus par jour — 30 derniers jours</h2>
          <VolumeParJour jours={donnees.volume_par_jour} />
        </section>

        <section className="carte">
          <h2>Répartition par catégorie</h2>
          <ParCategorie lignes={donnees.par_categorie} />
        </section>

        <section className="carte">
          <h2>Délai médian de réponse</h2>
          <p className="muted petit">Du premier message reçu à la première réponse envoyée.</p>
          <table className="simple">
            <thead>
              <tr><th>Catégorie</th><th className="num">Tickets</th><th className="num">Répondus</th><th className="num">Délai médian</th></tr>
            </thead>
            <tbody>
              {donnees.delais.map((d) => (
                <tr key={d.total ? "__total" : d.categorie ?? "__vide"} className={d.total ? "total" : undefined}>
                  <td>{d.total ? "Toutes catégories" : libelleCategorie(d.categorie)}</td>
                  <td className="num">{d.tickets}</td>
                  <td className="num">{d.repondus}</td>
                  <td className="num">{formatDuree(d.mediane_secondes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function Tuile({ libelle, valeur, note }: { libelle: string; valeur: number | string; note?: string }) {
  return (
    <div className="tuile">
      <div className="tuile-libelle">{libelle}</div>
      <div className="tuile-valeur">{valeur}</div>
      {note && <div className="muted petit">{note}</div>}
    </div>
  );
}

function VolumeParJour({ jours }: { jours: { jour: string; tickets: number }[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(1, ...jours.map((j) => j.tickets));
  // Graduation : un pas entier « rond » pour 3-4 lignes au plus.
  const pas = Math.max(1, Math.ceil(max / 4));
  const haut = Math.ceil(max / pas) * pas;
  const graduations = Array.from({ length: haut / pas + 1 }, (_, i) => i * pas);

  return (
    <div className="histo">
      <div className="histo-axe">
        {graduations.slice().reverse().map((g) => <span key={g}>{g}</span>)}
      </div>
      <div className="histo-zone" onMouseLeave={() => setSurvol(null)}>
        {graduations.map((g) => (
          <div key={g} className="histo-grille" style={{ bottom: `${(g / haut) * 100}%` }} />
        ))}
        <div className="histo-barres">
          {jours.map((j, i) => (
            <div
              key={j.jour}
              className={`histo-col${survol === i ? " survol" : ""}`}
              onMouseEnter={() => setSurvol(i)}
              aria-label={`${fmtJourLong.format(jourLocal(j.jour))} : ${j.tickets} ticket(s)`}
            >
              <div className="histo-barre" style={{ height: `${(j.tickets / haut) * 100}%` }} />
            </div>
          ))}
        </div>
        {survol !== null && (
          <div
            className="infobulle"
            style={{ left: `${((survol + 0.5) / jours.length) * 100}%` }}
          >
            <strong>{jours[survol].tickets}</strong> ticket{jours[survol].tickets > 1 ? "s" : ""}
            <div className="muted">{fmtJourLong.format(jourLocal(jours[survol].jour))}</div>
          </div>
        )}
      </div>
      <div />
      <div className="histo-x">
        {jours.map((j, i) => (
          <span key={j.jour}>{i % 5 === 4 || i === jours.length - 1 ? fmtJour.format(jourLocal(j.jour)) : ""}</span>
        ))}
      </div>
    </div>
  );
}

function ParCategorie({ lignes }: { lignes: { categorie: string | null; tickets: number }[] }) {
  const total = lignes.reduce((s, l) => s + l.tickets, 0);
  const max = Math.max(1, ...lignes.map((l) => l.tickets));
  if (total === 0) return <p className="muted">Aucun ticket.</p>;
  return (
    <div className="barres-h">
      {lignes.map((l) => (
        <div key={l.categorie ?? "__vide"} className="barre-h" title={`${l.tickets} ticket(s)`}>
          <span className="barre-h-libelle">{libelleCategorie(l.categorie)}</span>
          <span className="barre-h-piste">
            <span className="barre-h-remplie" style={{ width: `${(l.tickets / max) * 100}%` }} />
          </span>
          <span className="barre-h-valeur">
            {l.tickets} <span className="muted">· {Math.round((100 * l.tickets) / total)} %</span>
          </span>
        </div>
      ))}
    </div>
  );
}
