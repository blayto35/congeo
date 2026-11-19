import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Demande = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  comment: string | null;
  chevauchements: {
    first_name: string;
    last_name: string;
    start_date: string;
    end_date: string;
  }[];
};

function Manager() {
  const navigate = useNavigate();

  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [demandeSelectionnee, setDemandeSelectionnee] = useState<Demande | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | "cancel_approved" | "cancel_rejected" | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [traitement, setTraitement] = useState(false);

  async function chargerDemandes() {
    try {
      const reponse = await fetch("/api/manager/conges", {
        credentials: "include",
      });

      if (reponse.status === 401) {
        navigate("/connexion");
        return;
      }

      if (reponse.status === 403) {
        setErreur("Accès réservé aux managers.");
        return;
      }

      if (!reponse.ok) {
        throw new Error("Impossible de récupérer les demandes.");
      }

      setDemandes(await reponse.json());
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setChargement(false);
    }
  }

  function ouvrirModal(demande: Demande, choix: "approved" | "rejected" | "cancel_approved" | "cancel_rejected") {
    setDemandeSelectionnee(demande);
    setDecision(choix);
    setCommentaire("");
    setErreur("");
  }

  function fermerModal() {
    if (traitement) return;
    setDemandeSelectionnee(null);
    setDecision(null);
    setCommentaire("");
  }

  async function confirmerDecision() {
    if (!demandeSelectionnee || !decision) return;

    if (["rejected", "cancel_rejected"].includes(decision) && !commentaire.trim()) {
      setErreur("Merci de préciser le motif du refus.");
      return;
    }

    setTraitement(true);
    setErreur("");

    try {
      const estAnnulation = decision.startsWith("cancel_");
      const statutEnvoye = decision.endsWith("approved") ? "approved" : "rejected";
      const route = estAnnulation
        ? `/api/manager/conges/${demandeSelectionnee.id}/annulation`
        : `/api/manager/conges/${demandeSelectionnee.id}`;

      const reponse = await fetch(route, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: statutEnvoye,
          comment: commentaire.trim(),
        }),
      });

      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Impossible de traiter la demande.");
      }

      fermerModal();
      await chargerDemandes();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setTraitement(false);
    }
  }

  useEffect(() => {
    chargerDemandes();
  }, []);

  const demandesEnAttente = demandes.filter(
    (demande) => ["pending", "cancellation_requested"].includes(demande.status)
  );

  return (
    <main className="dashboard">
      <section className="dashboard-content">
        <p className="dashboard-subtitle">ESPACE DE GESTION</p>
        <h1>Gestion des congés</h1>
        <p className="dashboard-subtitle">
          Consultez et traitez les demandes de votre équipe.
        </p>

        <div className="dashboard-cards">
          <article className="dashboard-card">
            <span>Total des demandes</span>
            <strong>{demandes.length}</strong>
          </article>

          <article className="dashboard-card">
            <span>En attente</span>
            <strong>{demandesEnAttente.length}</strong>
          </article>

          <article className="dashboard-card">
            <span>Déjà traitées</span>
            <strong>{demandes.length - demandesEnAttente.length}</strong>
          </article>
        </div>

        <section className="requests-section">
          <div className="section-heading">
            <h2>Demandes de mon équipe</h2>
            <p>Les demandes des collaborateurs de votre équipe.</p>
          </div>

          {erreur && <p className="register-error">{erreur}</p>}

          {chargement ? (
            <p>Chargement des demandes...</p>
          ) : demandes.length === 0 ? (
            <div className="empty-state">
              <h3>Aucune demande</h3>
              <p>Votre équipe n'a pas encore déposé de demande.</p>
            </div>
          ) : (
            <div className="manager-list">
              {demandes.map((demande) => (
                <article className="manager-request" key={demande.id}>
                  <div className="manager-request-info">
                    <h3>{demande.first_name} {demande.last_name}</h3>
                    <p>
                      Du <strong>{demande.start_date}</strong> au{" "}
                      <strong>{demande.end_date}</strong>
                    </p>

                    {demande.status === "pending" && demande.chevauchements?.length > 0 && (
                      <div className="overlap-warning">
                        <strong>
                          ⚠️ Attention : {demande.chevauchements.length} collègue(s)
                          déjà en congé sur cette période
                        </strong>
                        <ul>
                          {demande.chevauchements.map((absence, index) => (
                            <li key={index}>
                              {absence.first_name} {absence.last_name} — du{" "}
                              {absence.start_date} au {absence.end_date}
                            </li>
                          ))}
                        </ul>
                        <small>Cette alerte est informative et ne bloque pas la décision.</small>
                      </div>
                    )}

                    <p>{demande.comment || "Aucun commentaire"}</p>
                    <span className={`status ${demande.status}`}>
                      {demande.status === "pending"
                        ? "En attente"
                        : demande.status === "cancellation_requested"
                        ? "Annulation demandée"
                        : demande.status === "cancelled"
                        ? "Annulée"
                        : demande.status === "approved"
                        ? "Acceptée"
                        : "Refusée"}
                    </span>
                  </div>

                  {demande.status === "pending" && (
                    <div className="manager-actions">
                      <button
                        className="approve-button"
                        onClick={() => ouvrirModal(demande, "approved")}
                      >
                        Accepter
                      </button>

                      <button
                        className="reject-button"
                        onClick={() => ouvrirModal(demande, "rejected")}
                      >
                        Refuser
                      </button>
                    </div>
                  )}

                  {demande.status === "cancellation_requested" && (
                    <div className="manager-actions">
                      <button
                        className="approve-button"
                        onClick={() => ouvrirModal(demande, "cancel_approved")}
                      >
                        Accepter l'annulation
                      </button>

                      <button
                        className="reject-button"
                        onClick={() => ouvrirModal(demande, "cancel_rejected")}
                      >
                        Refuser l'annulation
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {demandeSelectionnee && decision && (
        <div className="modal-overlay" onMouseDown={fermerModal}>
          <section
            className="decision-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={fermerModal}
              aria-label="Fermer"
            >
              ×
            </button>

            <div className={`modal-icon ${decision}`}>
              {["approved", "cancel_approved"].includes(decision) ? "✓" : "!"}
            </div>

            <h2 id="modal-title">
              {decision === "cancel_approved"
                ? "Accepter l'annulation"
                : decision === "cancel_rejected"
                ? "Refuser l'annulation"
                : decision === "approved"
                ? "Accepter la demande"
                : "Refuser la demande"}
            </h2>

            <p className="modal-description">
              {demandeSelectionnee.first_name} {demandeSelectionnee.last_name}
            </p>

            <div className="modal-period">
              Du <strong>{demandeSelectionnee.start_date}</strong> au{" "}
              <strong>{demandeSelectionnee.end_date}</strong>
            </div>

            <label className="modal-label" htmlFor="decision-comment">
              {["approved", "cancel_approved"].includes(decision)
                ? "Commentaire (facultatif)"
                : "Motif du refus *"}
            </label>

            <textarea
              id="decision-comment"
              value={commentaire}
              onChange={(event) => setCommentaire(event.target.value)}
              placeholder={
                ["approved", "cancel_approved"].includes(decision)
                  ? "Ajouter une précision..."
                  : "Expliquez la raison du refus..."
              }
              rows={4}
              autoFocus
            />

            {erreur && <p className="register-error">{erreur}</p>}

            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={fermerModal}
                disabled={traitement}
              >
                Annuler
              </button>

              <button
                className={["approved", "cancel_approved"].includes(decision) ? "modal-confirm approve" : "modal-confirm reject"}
                onClick={confirmerDecision}
                disabled={traitement}
              >
                {traitement
                  ? "Traitement..."
                  : ["approved", "cancel_approved"].includes(decision)
                  ? "Confirmer l'acceptation"
                  : "Confirmer le refus"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Manager;
