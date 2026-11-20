import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DashboardPremium.css";

interface Utilisateur {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface Conge {
  id: number;
  start_date: string;
  end_date: string;
  status: string;
  comment: string | null;
}

function Dashboard() {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [conges, setConges] = useState<Conge[]>([]);
  const [solde, setSolde] = useState<{
    joursAcquis: number;
    joursPris: number;
    joursReserves: number;
    disponible: number;
  } | null>(null);
  const [chargement, setChargement] = useState(true);

  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [annulationEnCours, setAnnulationEnCours] = useState<number | null>(null);

  const navigate = useNavigate();

  async function chargerDonnees() {
    try {
      const profil = await fetch("/api/profil", {
        credentials: "include",
      });

      if (!profil.ok) {
        navigate("/connexion");
        return;
      }

      const donneesProfil = await profil.json();
      setUtilisateur(donneesProfil.utilisateur);

      const demandes = await fetch("/api/conges", {
        credentials: "include",
      });

      if (demandes.ok) {
        setConges(await demandes.json());
      }

      const reponseSolde = await fetch("/api/solde", {
        credentials: "include",
      });

      if (reponseSolde.ok) {
        const donneesSolde = await reponseSolde.json();
        setSolde({
          joursAcquis: Number(donneesSolde.joursAcquis),
          joursPris: Number(donneesSolde.joursPris),
          joursReserves: Number(donneesSolde.joursReserves),
          disponible: Number(donneesSolde.disponible),
        });
      }
    } catch (erreur) {
      console.error("Erreur :", erreur);
      setErreur("Impossible de charger les données.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerDonnees();
  }, []);

  async function envoyerDemande(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setErreur("");
    setEnvoi(true);

    // Conversion AAAA-MM-JJ vers JJ-MM-AAAA
    const debutFrancais = dateDebut.split("-").reverse().join("-");
    const finFrancaise = dateFin.split("-").reverse().join("-");

    try {
      const response = await fetch("/api/conges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          start_date: debutFrancais,
          end_date: finFrancaise,
          comment: commentaire,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErreur(data.message || "Impossible de créer la demande.");
        return;
      }

      setMessage("Votre demande a bien été enregistrée !");
      setDateDebut("");
      setDateFin("");
      setCommentaire("");

      await chargerDonnees();

    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnvoi(false);
    }
  }

  async function annulerDemande(id: number) {
    const confirmation = window.confirm(
      "Voulez-vous envoyer une demande d'annulation à votre manager ?"
    );

    if (!confirmation) return;

    setMessage("");
    setErreur("");
    setAnnulationEnCours(id);

    try {
      const response = await fetch(
        `/api/conges/${id}/demander-annulation`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setErreur(data.message || "Impossible d'envoyer la demande d'annulation.");
        return;
      }

      setMessage(
        "Votre demande d'annulation a été envoyée à votre manager."
      );

      await chargerDonnees();

    } catch (erreur) {
      console.error("Erreur demande d'annulation :", erreur);
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setAnnulationEnCours(null);
    }
  }


  if (chargement) {
    return <p>Chargement du tableau de bord...</p>;
  }

  if (!utilisateur) {
    return null;
  }

  const demandesEnAttente = conges.filter(
    (conge) =>
      conge.status === "pending" ||
      conge.status === "cancellation_requested"
  ).length;

  return (
    <main className="dashboard">

      <section className="dashboard-content">
        <div className="dashboard-brand">
          <img src="/favicon.svg" alt="" />
          <span>Congeo</span>
        </div>
        <p className="eyebrow">ESPACE PERSONNEL</p>

        <h1>Bonjour {utilisateur.first_name} 👋</h1>

        <p className="dashboard-subtitle">
          Bienvenue dans votre espace de gestion des congés.
        </p>

        <div className="dashboard-cards">
          <article className="dashboard-card">
            <span>Jours acquis</span>
            <strong>{solde === null ? "…" : `${solde.joursAcquis.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} jours`}</strong>
            <small>Total des jours crédités</small>
          </article>

          <article className="dashboard-card">
            <span>Jours pris</span>
            <strong>{solde === null ? "…" : `${solde.joursPris.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} jours`}</strong>
            <small>Congés effectivement consommés</small>
          </article>

          <article className="dashboard-card">
            <span>Jours réservés</span>
            <strong>{solde === null ? "…" : `${solde.joursReserves.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} jours`}</strong>
            <small>Demandes en attente de validation</small>
          </article>

          <article className="dashboard-card">
            <span>Jours disponibles</span>
            <strong>{solde === null ? "…" : `${solde.disponible.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} jours`}</strong>
            <small>Solde réellement disponible</small>
          </article>

          <article className="dashboard-card">
            <span>Demandes en attente</span>
            <strong>{demandesEnAttente}</strong>
            <small>Demandes en cours de validation</small>
          </article>

          <article className="dashboard-card">
            <span>Total des demandes</span>
            <strong>{conges.length}</strong>
            <small>Depuis la création du compte</small>
          </article>
        </div>

        <section className="requests-section">
          <div className="section-heading">
            <h2>Nouvelle demande de congés</h2>
            <p>Choisissez les dates de votre absence.</p>
          </div>

          <form className="leave-form" onSubmit={envoyerDemande}>
            <div className="form-row">
              <div>
                <label htmlFor="dateDebut">Date de début</label>
                <input
                  id="dateDebut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="dateFin">Date de fin</label>
                <input
                  id="dateFin"
                  type="date"
                  value={dateFin}
                  min={dateDebut}
                  onChange={(e) => setDateFin(e.target.value)}
                  required
                />
              </div>
            </div>

            <label htmlFor="commentaire">Commentaire (facultatif)</label>
            <textarea
              id="commentaire"
              placeholder="Exemple : vacances en famille..."
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
            />

            {message && <p className="success-message">{message}</p>}
            {erreur && <p className="error-message">{erreur}</p>}

            <button type="submit" disabled={envoi}>
              {envoi ? "Envoi en cours..." : "Envoyer ma demande"}
            </button>
          </form>
        </section>

        <section className="requests-section history-section">
          <div className="section-heading">
            <h2>Mes demandes de congés</h2>
            <p>Retrouvez l'ensemble de vos demandes.</p>
          </div>

          {message && <p className="success-message">{message}</p>}
          {erreur && <p className="error-message">{erreur}</p>}

          {conges.length === 0 ? (
            <div className="empty-state">
              <span>📅</span>
              <h3>Aucune demande pour le moment</h3>
              <p>Vos prochaines demandes apparaîtront ici.</p>
            </div>
          ) : (
            <div className="requests-list">
              {conges.map((conge) => (
                <article className="request-item" key={conge.id}>
                  <div>
                    <strong>
                      Du {conge.start_date} au {conge.end_date}
                    </strong>
                    <p>{conge.comment || "Aucun commentaire"}</p>
                  </div>

                  <div className="request-actions">
                    <span className={`status ${conge.status}`}>
                      {conge.status === "pending"
                        ? "En attente"
                        : conge.status === "approved"
                        ? "Acceptée"
                        : conge.status === "cancellation_requested"
                        ? "Annulation en attente"
                        : conge.status === "cancelled"
                        ? "Annulée"
                        : "Refusée"}
                    </span>

                    {(conge.status === "pending" || conge.status === "approved") && (
                      <button
                        type="button"
                        className="cancel-request-button"
                        onClick={() => annulerDemande(conge.id)}
                        disabled={annulationEnCours === conge.id}
                      >
                        {annulationEnCours === conge.id
                          ? "Envoi..."
                          : "Demander l'annulation"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default Dashboard;
