import { useEffect, useMemo, useState } from "react";
import "./Historique.css";

interface Demande {
  id: number;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  comment: string | null;
}

function Historique() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [filtre, setFiltre] = useState("all");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetch("/api/conges", { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("Impossible de charger l'historique.");
        return response.json();
      })
      .then(setDemandes)
      .catch(() => setErreur("Impossible de charger vos demandes."))
      .finally(() => setChargement(false));
  }, []);

  const demandesFiltrees = useMemo(() => {
    if (filtre === "all") return demandes;
    return demandes.filter((demande) => demande.status === filtre);
  }, [demandes, filtre]);

  const statutLabel: Record<string, string> = {
    pending: "En attente",
    approved: "Acceptée",
    rejected: "Refusée",
    cancelled: "Annulée",
    cancellation_requested: "Annulation en attente",
  };

  const typeLabel: Record<string, string> = {
    paid_leave: "Congés payés",
    unpaid_leave: "Congés sans solde",
    rtt: "RTT",
    sick_leave: "Arrêt maladie",
    other: "Autre",
  };

  return (
    <main className="historique-page">
      <div className="historique-header">
        <div>
          <span className="historique-eyebrow">MES DEMANDES</span>
          <h1>Historique des congés</h1>
          <p>Retrouvez toutes vos demandes et leurs décisions.</p>
        </div>
        <div className="historique-total">
          <strong>{demandes.length}</strong>
          <span>demande(s)</span>
        </div>
      </div>

      <div className="historique-filtres">
        <label htmlFor="filtre-statut">Filtrer par statut</label>
        <select
          id="filtre-statut"
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
        >
          <option value="all">Toutes les demandes</option>
          <option value="pending">En attente</option>
          <option value="approved">Acceptées</option>
          <option value="rejected">Refusées</option>
          <option value="cancelled">Annulées</option>
          <option value="cancellation_requested">Annulation en attente</option>
        </select>
      </div>

      {chargement ? (
        <p className="historique-message">Chargement de vos demandes...</p>
      ) : erreur ? (
        <p className="historique-message historique-erreur">{erreur}</p>
      ) : demandesFiltrees.length === 0 ? (
        <div className="historique-vide">
          <span>📭</span>
          <h2>Aucune demande trouvée</h2>
          <p>Vos demandes apparaîtront ici.</p>
        </div>
      ) : (
        <div className="historique-table-container">
          <table className="historique-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Type</th>
                <th>Du</th>
                <th>Au</th>
                <th>Statut</th>
                <th>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {demandesFiltrees.map((demande) => (
                <tr key={demande.id}>
                  <td>#{demande.id}</td>
                  <td>{typeLabel[demande.leave_type] || demande.leave_type}</td>
                  <td>{demande.start_date}</td>
                  <td>{demande.end_date}</td>
                  <td>
                    <span className={`historique-statut statut-${demande.status}`}>
                      {statutLabel[demande.status] || demande.status}
                    </span>
                  </td>
                  <td>{demande.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default Historique;
