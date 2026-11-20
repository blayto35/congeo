import { useEffect, useMemo, useState } from "react";
import "./Calendrier.css";

interface Conge {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
}

const nomsMois = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const types: Record<string, string> = {
  paid_leave: "Congés payés",
  unpaid_leave: "Sans solde",
  sick_leave: "Maladie",
  other: "Autre",
};

function dateLocale(date: Date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

function Calendrier() {
  const [mois, setMois] = useState(() => {
    const maintenant = new Date();
    return new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  });
  const [conges, setConges] = useState<Conge[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const cleMois = `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur("");

    fetch(`/api/calendrier?mois=${cleMois}`, {
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Erreur de chargement");
        return response.json();
      })
      .then((data: Conge[]) => {
        if (actif) setConges(data);
      })
      .catch(() => {
        if (actif) setErreur("Impossible de charger les congés.");
      })
      .finally(() => {
        if (actif) setChargement(false);
      });

    return () => {
      actif = false;
    };
  }, [cleMois]);

  const jours = useMemo(() => {
    const premier = new Date(mois.getFullYear(), mois.getMonth(), 1);
    const decalage = (premier.getDay() + 6) % 7;
    const debut = new Date(premier);
    debut.setDate(premier.getDate() - decalage);

    const dernier = new Date(mois.getFullYear(), mois.getMonth() + 1, 0);
    const fin = new Date(dernier);
    fin.setDate(dernier.getDate() + (6 - (dernier.getDay() + 6) % 7));

    const resultat: Date[] = [];
    const courant = new Date(debut);

    while (courant <= fin) {
      resultat.push(new Date(courant));
      courant.setDate(courant.getDate() + 1);
    }

    return resultat;
  }, [mois]);

  function congesDuJour(date: Date) {
    const cle = dateLocale(date);
    return conges.filter(
      (conge) => conge.start_date <= cle && conge.end_date >= cle
    );
  }

  function statistiquesDuJour(date: Date) {
    const evenements = congesDuJour(date);

    const compterPersonnes = (statut: string) =>
      new Set(
        evenements
          .filter((conge) => conge.status === statut)
          .map((conge) => conge.user_id)
      ).size;

    return {
      approuves: compterPersonnes("approved"),
      enAttente: compterPersonnes("pending"),
      annulations: compterPersonnes("cancellation_requested"),
    };
  }

  function changerMois(decalage: number) {
    setMois(new Date(mois.getFullYear(), mois.getMonth() + decalage, 1));
  }

  return (
    <main className="calendrier-page">
      <div className="calendrier-entete">
        <div>
          <span className="calendrier-sur titre">PLANNING</span>
          <h1>Calendrier des congés</h1>
          <p>Visualisez les absences du mois.</p>
        </div>

        <div className="calendrier-navigation">
          <button onClick={() => changerMois(-1)} aria-label="Mois précédent">‹</button>
          <strong>{nomsMois[mois.getMonth()]} {mois.getFullYear()}</strong>
          <button onClick={() => changerMois(1)} aria-label="Mois suivant">›</button>
          <button className="calendrier-aujourdhui" onClick={() => {
            const maintenant = new Date();
            setMois(new Date(maintenant.getFullYear(), maintenant.getMonth(), 1));
          }}>Aujourd'hui</button>
        </div>
      </div>

      <div className="calendrier-legende">
        <span><i className="legende-approuve" /> Accepté</span>
        <span><i className="legende-attente" /> En attente</span>
        <span><i className="legende-annulation" /> Annulation demandée</span>
      </div>

      {erreur && <p className="calendrier-erreur">{erreur}</p>}
      {chargement && <p className="calendrier-chargement">Chargement...</p>}

      {!chargement && !erreur && (
        <div className="calendrier-grille">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((jour) => (
            <div className="calendrier-jour-semaine" key={jour}>{jour}</div>
          ))}

          {jours.map((date) => {
            const horsMois = date.getMonth() !== mois.getMonth();
            const aujourdhui = dateLocale(date) === dateLocale(new Date());
            const evenements = congesDuJour(date);

            return (
              <div
                key={dateLocale(date)}
                className={`calendrier-case ${horsMois ? "hors-mois" : ""} ${aujourdhui ? "est-aujourdhui" : ""}`}
              >
                <span className="calendrier-numero">{date.getDate()}</span>

                {(() => {
                  const stats = statistiquesDuJour(date);

                  if (!stats.approuves && !stats.enAttente && !stats.annulations) {
                    return null;
                  }

                  return (
                    <div className="calendrier-effectifs">
                      {stats.approuves > 0 && (
                        <span className="effectif-approuve">
                          {stats.approuves} absent{stats.approuves > 1 ? "s" : ""}
                        </span>
                      )}
                      {stats.enAttente > 0 && (
                        <span className="effectif-attente">
                          {stats.enAttente} en attente
                        </span>
                      )}
                      {stats.annulations > 0 && (
                        <span className="effectif-annulation">
                          {stats.annulations} annulation{stats.annulations > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div className="calendrier-evenements">
                  {evenements.map((conge) => (
                    <div
                      key={conge.id}
                      className={`calendrier-evenement evenement-${conge.status}`}
                      title={`${conge.first_name} ${conge.last_name} — ${types[conge.leave_type] || conge.leave_type}`}
                    >
                      <div className="collaborateur-identite">
                        <span className="collaborateur-avatar">
                          <span>{conge.first_name.charAt(0)}{conge.last_name.charAt(0)}</span>
                          <img
                            src={`/api/utilisateurs/${conge.user_id}/photo`}
                            alt=""
                            onError={(event) => { event.currentTarget.style.display = "none"; }}
                          />
                        </span>
                        <strong>{conge.first_name} {conge.last_name}</strong>
                      </div>
                      <small>{types[conge.leave_type] || conge.leave_type}</small>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!chargement && !erreur && conges.length === 0 && (
        <p className="calendrier-vide">Aucun congé prévu sur cette période.</p>
      )}
    </main>
  );
}

export default Calendrier;
