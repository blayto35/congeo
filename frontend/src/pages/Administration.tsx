import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Acquisitions.css";

type ExecutionAcquisition = {
  id: number;
  started_at: string;
  finished_at: string | null;
  period_year: number | null;
  period_month: number | null;
  status: "success" | "ignored" | "error";
  credits_count: number;
  days_credited: string | number;
  duplicates_ignored: number;
  message: string | null;
};

type DetailAcquisition = {
  id: number;
  user_id: number | null;
  user_name: string;
  amount: string | number;
  status: "credited" | "duplicate" | "error";
  message: string | null;
  created_at: string;
};

type MouvementConge = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  team_name: string | null;
  year: number;
  period_month: number | null;
  amount: string | number;
  transaction_type: "accrual" | "adjustment" | "leave_taken" | "reversal";
  description: string | null;
  created_at: string;
};

type Utilisateur = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  team_id: number | null;
  team_name: string | null;
  hire_date: string | null;
};

type Equipe = {
  id: number;
  name: string;
  manager_id: number | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
};

function Administration() {
  const navigate = useNavigate();

  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [mouvements, setMouvements] = useState<MouvementConge[]>([]);
  const [chargementMouvements, setChargementMouvements] = useState(true);
  const [erreurMouvements, setErreurMouvements] = useState("");
  const [filtreUtilisateur, setFiltreUtilisateur] = useState("all");
  const [filtreAnnee, setFiltreAnnee] = useState(String(new Date().getFullYear()));
  const [filtreType, setFiltreType] = useState("all");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [nouvelleEquipe, setNouvelleEquipe] = useState("");
  const [recherche, setRecherche] = useState("");
  const [enregistrement, setEnregistrement] = useState<number | null>(null);
  const [nouveauCollaborateur, setNouveauCollaborateur] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "employee",
    team_id: "",
    hire_date: "",
  });
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [parametresConges, setParametresConges] = useState({
    monthly_accrual: "2.50",
    accrual_day: "1",
  });
  const [chargementParametres, setChargementParametres] = useState(true);
  const [historiqueAcquisitions, setHistoriqueAcquisitions] = useState<ExecutionAcquisition[]>([]);
  const [chargementHistoriqueAcquisitions, setChargementHistoriqueAcquisitions] = useState(true);
  const [erreurHistoriqueAcquisitions, setErreurHistoriqueAcquisitions] = useState("");
  const [filtreStatutAcquisitions, setFiltreStatutAcquisitions] = useState("all");
  const [filtreAnneeAcquisitions, setFiltreAnneeAcquisitions] = useState("");
  const [filtreMoisAcquisitions, setFiltreMoisAcquisitions] = useState("");

  const [statistiquesAcquisitions, setStatistiquesAcquisitions] = useState({
    executions_reussies: 0,
    executions_erreur: 0,
    doublons_evites: 0,
    jours_acquis: 0,
  });

  const [executionOuverte, setExecutionOuverte] = useState<number | null>(null);
  const [detailsAcquisitions, setDetailsAcquisitions] = useState<Record<number, DetailAcquisition[]>>({});
  const [chargementDetails, setChargementDetails] = useState<number | null>(null);
  const [erreursDetails, setErreursDetails] = useState<Record<number, string>>({});
  const [sauvegardeParametres, setSauvegardeParametres] = useState(false);

  useEffect(() => {
    async function chargerStatistiquesAcquisitions() {
      try {
        const reponse = await fetch("/api/admin/statistiques-acquisitions", {
          credentials: "include",
        });

        if (!reponse.ok) {
          throw new Error("Impossible de charger les statistiques.");
        }

        const donnees = await reponse.json();

        setStatistiquesAcquisitions({
          executions_reussies: Number(donnees.executions_reussies) || 0,
          executions_erreur: Number(donnees.executions_erreur) || 0,
          doublons_evites: Number(donnees.doublons_evites) || 0,
          jours_acquis: Number(donnees.jours_acquis) || 0,
        });
      } catch (erreur) {
        console.error("Statistiques des acquisitions :", erreur);
      }
    }

    chargerStatistiquesAcquisitions();
  }, []);



  async function chargerDonnees() {
    setChargement(true);
    setErreur("");

    try {
      const [reponseUtilisateurs, reponseEquipes] = await Promise.all([
        fetch("/api/admin/utilisateurs", { credentials: "include" }),
        fetch("/api/admin/equipes", { credentials: "include" }),
      ]);

      if (reponseUtilisateurs.status === 401) {
        navigate("/connexion");
        return;
      }

      if (reponseUtilisateurs.status === 403 || reponseEquipes.status === 403) {
        setErreur("Accès réservé au super-administrateur.");
        return;
      }

      if (!reponseUtilisateurs.ok || !reponseEquipes.ok) {
        throw new Error("Impossible de charger les données.");
      }

      setUtilisateurs(await reponseUtilisateurs.json());
      setEquipes(await reponseEquipes.json());
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setChargement(false);
    }
  }

  async function chargerMouvements() {
    setChargementMouvements(true);
    setErreurMouvements("");

    try {
      const parametres = new URLSearchParams();
      if (filtreUtilisateur !== "all") parametres.set("userId", filtreUtilisateur);
      if (filtreAnnee !== "all") parametres.set("annee", filtreAnnee);
      if (filtreType !== "all") parametres.set("type", filtreType);

      const reponse = await fetch(
        `/api/admin/transactions?${parametres.toString()}`,
        { credentials: "include" }
      );

      const donnees = await reponse.json();
      if (!reponse.ok) {
        throw new Error(donnees.message || "Chargement des mouvements impossible.");
      }

      setMouvements(donnees);
    } catch (error) {
      setErreurMouvements(
        error instanceof Error ? error.message : "Une erreur est survenue."
      );
    } finally {
      setChargementMouvements(false);
    }
  }

  useEffect(() => {
    chargerMouvements();
  }, [filtreUtilisateur, filtreAnnee, filtreType]);

  async function modifierEquipe(utilisateurId: number, teamId: string) {
    setEnregistrement(utilisateurId);
    setErreur("");
    setMessage("");

    try {
      const reponse = await fetch(
        `/api/admin/utilisateurs/${utilisateurId}/equipe`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ team_id: Number(teamId) }),
        }
      );

      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Modification impossible.");
      }

      setMessage("Équipe mise à jour avec succès.");
      await chargerDonnees();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setEnregistrement(null);
    }
  }

  async function modifierRole(utilisateurId: number, role: string) {
    setEnregistrement(utilisateurId);
    setErreur("");
    setMessage("");

    try {
      const reponse = await fetch(
        `/api/admin/utilisateurs/${utilisateurId}/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role }),
        }
      );

      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Modification du rôle impossible.");
      }

      setMessage("Rôle mis à jour avec succès.");
      await chargerDonnees();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setEnregistrement(null);
    }
  }

  async function modifierResponsable(equipeId: number, managerId: string) {
    setErreur("");
    setMessage("");

    try {
      const reponse = await fetch(`/api/admin/equipes/${equipeId}/responsable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          manager_id: managerId === "" ? null : Number(managerId),
        }),
      });

      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.message || "Désignation impossible.");

      setMessage(donnees.message || "Responsable mis à jour.");
      await chargerDonnees();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  }

  async function creerCollaborateur(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur("");
    setMessage("");
    setCreationEnCours(true);

    try {
      const reponse = await fetch("/api/admin/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(nouveauCollaborateur),
      });

      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Création impossible.");
      }

      setMessage("Collaborateur créé avec succès.");
      setNouveauCollaborateur({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        role: "employee",
        team_id: "",
        hire_date: "",
      });
      await chargerDonnees();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setCreationEnCours(false);
    }
  }

  async function creerEquipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur("");
    setMessage("");

    try {
      const reponse = await fetch("/api/admin/equipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nouvelleEquipe }),
      });

      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Création impossible.");
      }

      setNouvelleEquipe("");
      setMessage("Nouvelle équipe créée.");
      await chargerDonnees();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  }


  async function renommerEquipe(equipe: Equipe) {
    const nom = window.prompt("Nouveau nom de l'équipe :", equipe.name);
    if (nom === null || !nom.trim()) return;

    setErreur("");
    setMessage("");

    try {
      const reponse = await fetch(`/api/admin/equipes/${equipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nom.trim() }),
      });

      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.message || "Renommage impossible.");

      setMessage("Équipe renommée avec succès.");
      await chargerDonnees();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  }

  async function supprimerEquipe(equipe: Equipe) {
    if (!window.confirm(`Supprimer l'équipe « ${equipe.name} » ?`)) return;

    setErreur("");
    setMessage("");

    try {
      const reponse = await fetch(`/api/admin/equipes/${equipe.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.message || "Suppression impossible.");

      setMessage("Équipe supprimée.");
      await chargerDonnees();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  }

  useEffect(() => {
    chargerDonnees();
    chargerParametresConges();
    chargerHistoriqueAcquisitions();
  }, []);

  async function modifierDateArrivee(utilisateurId: number, hireDate: string) {
    setEnregistrement(utilisateurId);
    setErreur("");

    try {
      const reponse = await fetch(
        `/api/admin/utilisateurs/${utilisateurId}/date-arrivee`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ hire_date: hireDate }),
        }
      );

      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Impossible de modifier la date.");
      }

      setUtilisateurs((anciens) =>
        anciens.map((u) =>
          u.id === utilisateurId ? { ...u, hire_date: donnees.utilisateur.hire_date } : u
        )
      );
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setEnregistrement(null);
    }
  }

  async function afficherDetailsAcquisition(id: number) {
    if (executionOuverte === id) {
      setExecutionOuverte(null);
      return;
    }

    setExecutionOuverte(id);

    if (detailsAcquisitions[id]) return;

    setChargementDetails(id);
    setErreursDetails((precedentes) => {
      const nouvelles = { ...precedentes };
      delete nouvelles[id];
      return nouvelles;
    });

    try {
      const reponse = await fetch(
        `/api/admin/historique-acquisitions/${id}/details`,
        { credentials: "include" }
      );
      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Impossible de charger les détails.");
      }

      setDetailsAcquisitions((precedents) => ({
        ...precedents,
        [id]: donnees,
      }));
    } catch (error) {
      setErreursDetails((precedentes) => ({
        ...precedentes,
        [id]: error instanceof Error ? error.message : "Erreur de chargement.",
      }));
    } finally {
      setChargementDetails(null);
    }
  }

  async function chargerHistoriqueAcquisitions() {
    setChargementHistoriqueAcquisitions(true);
    setErreurHistoriqueAcquisitions("");

    try {
      const parametres = new URLSearchParams();

      if (filtreStatutAcquisitions !== "all") {
        parametres.set("statut", filtreStatutAcquisitions);
      }

      if (filtreAnneeAcquisitions) {
        parametres.set("annee", filtreAnneeAcquisitions);
      }

      if (filtreMoisAcquisitions) {
        parametres.set("mois", filtreMoisAcquisitions);
      }

      const suffixe = parametres.toString();
      const url = suffixe
        ? `/api/admin/historique-acquisitions?${suffixe}`
        : "/api/admin/historique-acquisitions";

      const reponse = await fetch(url, {
        credentials: "include",
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Impossible de charger le journal.");
      }

      setHistoriqueAcquisitions(donnees);
    } catch (error) {
      setErreurHistoriqueAcquisitions(
        error instanceof Error ? error.message : "Erreur de chargement du journal."
      );
    } finally {
      setChargementHistoriqueAcquisitions(false);
    }
  }

  async function chargerParametresConges() {
    setChargementParametres(true);

    try {
      const reponse = await fetch("/api/admin/parametres-conges", {
        credentials: "include",
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Impossible de charger les paramètres.");
      }

      setParametresConges({
        monthly_accrual: String(donnees.monthly_accrual),
        accrual_day: String(donnees.accrual_day),
      });
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Erreur de chargement des paramètres.");
    } finally {
      setChargementParametres(false);
    }
  }

  async function enregistrerParametresConges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSauvegardeParametres(true);
    setErreur("");
    setMessage("");

    try {
      const reponse = await fetch("/api/admin/parametres-conges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          monthly_accrual: Number(parametresConges.monthly_accrual),
          accrual_day: Number(parametresConges.accrual_day),
        }),
      });

      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || "Impossible d'enregistrer les paramètres.");
      }

      setParametresConges({
        monthly_accrual: String(donnees.parametres.monthly_accrual),
        accrual_day: String(donnees.parametres.accrual_day),
      });
      setMessage("Paramètres des congés enregistrés avec succès.");
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setSauvegardeParametres(false);
    }
  }

  const utilisateursFiltres = utilisateurs.filter((utilisateur) =>
    `${utilisateur.first_name} ${utilisateur.last_name} ${utilisateur.email}`
      .toLowerCase()
      .includes(recherche.toLowerCase())
  );

  const sansEquipe = utilisateurs.filter((u) => !u.team_id).length;

  return (
    <main className="dashboard admin-page">

      <section className="dashboard-content admin-content">
        <div className="admin-eyebrow">CENTRE DE CONTRÔLE</div>
        <h1>Administration</h1>
        <p className="dashboard-subtitle">
          Gérez les collaborateurs et leur affectation aux équipes.
        </p>

        <div className="dashboard-cards admin-stats">
          <article className="dashboard-card">
            <span>Collaborateurs</span>
            <strong>{utilisateurs.length}</strong>
          </article>
          <article className="dashboard-card">
            <span>Équipes</span>
            <strong>{equipes.length}</strong>
          </article>
          <article className="dashboard-card">
            <span>Sans équipe</span>
            <strong>{sansEquipe}</strong>
          </article>
        </div>

        {erreur && <div className="admin-alert error">{erreur}</div>}
        {message && <div className="admin-alert success">{message}</div>}

        <section className="admin-panel acquisitions-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">GESTION DES CONGÉS</span>
              <h2>Paramètres des acquisitions</h2>
              <p>Définissez le nombre de jours acquis chaque mois et le jour du crédit automatique.</p>
            </div>
          </div>

          {chargementParametres ? (
            <p>Chargement des paramètres...</p>
          ) : (
            <form className="acquisitions-filters" onSubmit={enregistrerParametresConges}>
              <label>
                Jours acquis par mois
                <input
                  type="number"
                  min="0.01"
                  max="999.99"
                  step="0.01"
                  value={parametresConges.monthly_accrual}
                  onChange={(event) =>
                    setParametresConges({
                      ...parametresConges,
                      monthly_accrual: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Jour du mois pour le crédit
                <input
                  type="number"
                  min="1"
                  max="28"
                  step="1"
                  value={parametresConges.accrual_day}
                  onChange={(event) =>
                    setParametresConges({
                      ...parametresConges,
                      accrual_day: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <button className="acquisitions-refresh" type="submit" disabled={sauvegardeParametres}>
                {sauvegardeParametres ? "Enregistrement..." : "Enregistrer les paramètres"}
              </button>
            </form>
          )}
          <p className="acquisitions-empty">
            Le crédit automatique sera effectué à 03 h 05, selon le jour configuré.
          </p>
        </section>

        <section className="admin-panel acquisitions-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">SUIVI AUTOMATIQUE</span>
              <h2>Historique des acquisitions</h2>
              <p>Les 100 dernières exécutions du traitement automatique.</p>
            </div>
            <button
              type="button"
              className="acquisitions-refresh"
              onClick={chargerHistoriqueAcquisitions}
              disabled={chargementHistoriqueAcquisitions}
            >
              Actualiser
            </button>
          </div>

          {erreurHistoriqueAcquisitions && (
            <div className="admin-alert error">{erreurHistoriqueAcquisitions}</div>
          )}

          <div className="acquisition-summary">
            <div className="acquisition-summary-card success">
              Jours acquis au total
              <strong>{statistiquesAcquisitions.jours_acquis.toFixed(2)}</strong>
            </div>

            <div className="acquisition-summary-card success">
              Exécutions réussies
              <strong>{statistiquesAcquisitions.executions_reussies}</strong>
            </div>

            <div className="acquisition-summary-card error">
              Exécutions en erreur
              <strong>{statistiquesAcquisitions.executions_erreur}</strong>
            </div>

            <div className="acquisition-summary-card duplicate">
              Doublons évités
              <strong>{statistiquesAcquisitions.doublons_evites}</strong>
            </div>
          </div>

          <div className="acquisition-filters">
            <label>
              Statut
              <select
                value={filtreStatutAcquisitions}
                onChange={(e) => setFiltreStatutAcquisitions(e.target.value)}
              >
                <option value="all">Tous les statuts</option>
                <option value="success">Réussite</option>
                <option value="ignored">Ignoré</option>
                <option value="error">Erreur</option>
              </select>
            </label>

            <label>
              Année
              <select
                value={filtreAnneeAcquisitions}
                onChange={(e) => setFiltreAnneeAcquisitions(e.target.value)}
              >
                <option value="">Toutes les années</option>
                {Array.from({ length: 10 }, (_, index) => new Date().getFullYear() - index).map((annee) => (
                  <option key={annee} value={annee}>{annee}</option>
                ))}
              </select>
            </label>

            <label>
              Mois
              <select
                value={filtreMoisAcquisitions}
                onChange={(e) => setFiltreMoisAcquisitions(e.target.value)}
              >
                <option value="">Tous les mois</option>
                {[
                  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
                ].map((nom, index) => (
                  <option key={index + 1} value={index + 1}>{nom}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="acquisitions-refresh"
              onClick={chargerHistoriqueAcquisitions}
              disabled={chargementHistoriqueAcquisitions}
            >
              Appliquer les filtres
            </button>

            <button
              type="button"
              className="acquisitions-refresh"
              onClick={() => {
                setFiltreStatutAcquisitions("all");
                setFiltreAnneeAcquisitions("");
                setFiltreMoisAcquisitions("");
                setTimeout(() => chargerHistoriqueAcquisitions(), 0);
              }}
              disabled={chargementHistoriqueAcquisitions}
            >
              Réinitialiser
            </button>
          </div>

          {chargementHistoriqueAcquisitions ? (
            <p>Chargement de l'historique...</p>
          ) : historiqueAcquisitions.length === 0 ? (
            <p className="acquisitions-empty">Aucune exécution enregistrée pour le moment.</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table acquisitions-table">
                <thead>
                  <tr>
                    <th>Date d'exécution</th>
                    <th>Période créditée</th>
                    <th>Résultat</th>
                    <th>Collaborateurs</th>
                    <th>Jours attribués</th>
                    <th>Doublons évités</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {historiqueAcquisitions.map((execution) => (
                    <Fragment key={execution.id}>
                      <tr>
                        <td>{new Date(execution.started_at).toLocaleString("fr-FR")}</td>
                        <td>
                          {execution.period_month && execution.period_year
                            ? `${String(execution.period_month).padStart(2, "0")}/${execution.period_year}`
                            : "—"}
                        </td>
                        <td>
                          <span className={`acquisitions-type ${
                            execution.status === "success"
                              ? "type-accrual"
                              : execution.status === "ignored"
                                ? "type-adjustment"
                                : "type-leave_taken"
                          }`}>
                            {execution.status === "success"
                              ? "Réussite"
                              : execution.status === "ignored"
                                ? "Ignoré"
                                : "Erreur"}
                          </span>
                        </td>
                        <td>{execution.credits_count}</td>
                        <td>{Number(execution.days_credited).toFixed(2)}</td>
                        <td>{execution.duplicates_ignored}</td>
                        <td>
                          <button
                            type="button"
                            className="acquisitions-refresh"
                            onClick={() => afficherDetailsAcquisition(execution.id)}
                          >
                            {executionOuverte === execution.id
                              ? "Masquer"
                              : "Voir le détail"}
                          </button>
                        </td>
                      </tr>

                      {executionOuverte === execution.id && (
                        <tr>
                          <td colSpan={7}>
                            <div className="acquisition-details">
                              <h3>Détail de l'exécution</h3>

                              {detailsAcquisitions[execution.id] && (
                                <div className="acquisition-summary">
                                  <div className="acquisition-summary-card success">
                                    Crédités
                                    <strong>
                                      {detailsAcquisitions[execution.id].filter(
                                        (detail) => detail.status === "credited"
                                      ).length}
                                    </strong>
                                  </div>

                                  <div className="acquisition-summary-card duplicate">
                                    Doublons évités
                                    <strong>
                                      {detailsAcquisitions[execution.id].filter(
                                        (detail) => detail.status === "duplicate"
                                      ).length}
                                    </strong>
                                  </div>

                                  <div className="acquisition-summary-card error">
                                    Erreurs
                                    <strong>
                                      {detailsAcquisitions[execution.id].filter(
                                        (detail) => detail.status === "error"
                                      ).length}
                                    </strong>
                                  </div>
                                </div>
                              )}

                              {chargementDetails === execution.id ? (
                                <p>Chargement des détails...</p>
                              ) : erreursDetails[execution.id] ? (
                                <div className="admin-alert error">
                                  {erreursDetails[execution.id]}
                                </div>
                              ) : detailsAcquisitions[execution.id]?.length ? (
                                <div className="admin-table-wrapper">
                                  <table className="admin-table acquisitions-table">
                                    <thead>
                                      <tr>
                                        <th>Collaborateur</th>
                                        <th>Jours</th>
                                        <th>Statut</th>
                                        <th>Message</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detailsAcquisitions[execution.id].map((detail) => (
                                        <tr key={detail.id}>
                                          <td>{detail.user_name}</td>
                                          <td>{Number(detail.amount).toFixed(2)}</td>
                                          <td>
                                            <span className={`acquisition-badge ${
                                              detail.status === "credited"
                                                ? "credited"
                                                : detail.status === "duplicate"
                                                  ? "duplicate"
                                                  : "error"
                                            }`}>
                                              {detail.status === "credited"
                                                ? "Crédit effectué"
                                                : detail.status === "duplicate"
                                                  ? "Doublon évité"
                                                  : "Erreur"}
                                            </span>
                                          </td>
                                          <td>{detail.message || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="acquisitions-empty">
                                  Aucun détail individuel enregistré pour cette exécution.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">NOUVEAU COMPTE</span>
              <h2>Ajouter un collaborateur</h2>
              <p>Créez un compte et définissez ses accès dès son arrivée.</p>
            </div>
          </div>

          <form className="admin-team-form" onSubmit={creerCollaborateur}>
            <input
              placeholder="Prénom"
              value={nouveauCollaborateur.first_name}
              onChange={(e) => setNouveauCollaborateur({ ...nouveauCollaborateur, first_name: e.target.value })}
              required
            />
            <input
              placeholder="Nom"
              value={nouveauCollaborateur.last_name}
              onChange={(e) => setNouveauCollaborateur({ ...nouveauCollaborateur, last_name: e.target.value })}
              required
            />
            <input
              type="email"
              placeholder="Adresse e-mail"
              value={nouveauCollaborateur.email}
              onChange={(e) => setNouveauCollaborateur({ ...nouveauCollaborateur, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Mot de passe provisoire (12 caractères minimum)"
              minLength={12}
              value={nouveauCollaborateur.password}
              onChange={(e) => setNouveauCollaborateur({ ...nouveauCollaborateur, password: e.target.value })}
              required
            />
            <label className="admin-date-field">
              Date d'arrivée
              <input
                type="date"
                value={nouveauCollaborateur.hire_date}
                onChange={(e) => setNouveauCollaborateur({
                  ...nouveauCollaborateur,
                  hire_date: e.target.value
                })}
                required
              />
            </label>
            <select
              className="admin-team-select"
              value={nouveauCollaborateur.role}
              onChange={(e) => setNouveauCollaborateur({ ...nouveauCollaborateur, role: e.target.value })}
            >
              <option value="employee">Employé</option>
              <option value="manager">Manager</option>
            </select>
            <select
              className="admin-team-select"
              value={nouveauCollaborateur.team_id}
              onChange={(e) => setNouveauCollaborateur({ ...nouveauCollaborateur, team_id: e.target.value })}
              required
            >
              <option value="">Choisir une équipe</option>
              {equipes.map((equipe) => (
                <option key={equipe.id} value={equipe.id}>{equipe.name}</option>
              ))}
            </select>
            <button type="submit" className="admin-primary-button" disabled={creationEnCours}>
              {creationEnCours ? "Création..." : "+ Créer le compte"}
            </button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">ORGANISATION</span>
              <h2>Équipes</h2>
              <p>Créez les équipes de votre organisation.</p>
            </div>
          </div>

          <form className="admin-team-form" onSubmit={creerEquipe}>
            <input
              value={nouvelleEquipe}
              onChange={(event) => setNouvelleEquipe(event.target.value)}
              placeholder="Nom de la nouvelle équipe"
              minLength={2}
              maxLength={80}
              required
            />
            <button type="submit" className="admin-primary-button">
              + Créer une équipe
            </button>
          </form>

          <div className="admin-team-list">
            {equipes.map((equipe) => {
              const nombreMembres = utilisateurs.filter(
                (utilisateur) => utilisateur.team_id === equipe.id
              ).length;

              return (
                <div className="admin-team-chip" key={equipe.id}>
                  <div className="admin-team-identity">
                    <span className="admin-team-dot" />
                    <div>
                      <strong>{equipe.name}</strong>
                      <span>{nombreMembres} membre(s)</span>
                    </div>
                  </div>

                  <select
                    className="admin-team-select"
                    value={equipe.manager_id ?? ""}
                    onChange={(event) => modifierResponsable(equipe.id, event.target.value)}
                    aria-label={`Responsable de ${equipe.name}`}
                  >
                    <option value="">Aucun responsable</option>
                    {utilisateurs
                      .filter((utilisateur) =>
                        utilisateur.role === "manager" && utilisateur.team_id === equipe.id
                      )
                      .map((utilisateur) => (
                        <option key={utilisateur.id} value={utilisateur.id}>
                          {utilisateur.first_name} {utilisateur.last_name}
                        </option>
                      ))}
                  </select>

                  <div className="admin-team-actions">
                    <button
                      type="button"
                      className="admin-team-action"
                      onClick={() => renommerEquipe(equipe)}
                      title="Renommer l'équipe"
                      aria-label={`Renommer ${equipe.name}`}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="admin-team-action admin-team-delete"
                      onClick={() => supprimerEquipe(equipe)}
                      title="Supprimer l'équipe"
                      aria-label={`Supprimer ${equipe.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
            {equipes.length === 0 && <p>Aucune équipe créée.</p>}
          </div>
        </section>


        <section className="admin-panel acquisitions-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">SUIVI DES SOLDES</span>
              <h2>Historique des mouvements</h2>
              <p>Consultez les acquisitions et les autres mouvements de congés enregistrés.</p>
            </div>
          </div>

          <div className="acquisitions-filters">
            <label>
              Collaborateur
              <select value={filtreUtilisateur} onChange={(e) => setFiltreUtilisateur(e.target.value)}>
                <option value="all">Tous les collaborateurs</option>
                {utilisateurs.map((u) => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
            </label>

            <label>
              Année
              <select value={filtreAnnee} onChange={(e) => setFiltreAnnee(e.target.value)}>
                <option value="all">Toutes les années</option>
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map((annee) => (
                  <option key={annee} value={annee}>{annee}</option>
                ))}
              </select>
            </label>

            <label>
              Type de mouvement
              <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
                <option value="all">Tous les mouvements</option>
                <option value="accrual">Acquisition automatique</option>
                <option value="adjustment">Ajustement manuel</option>
                <option value="leave_taken">Congés pris</option>
                <option value="reversal">Régularisation</option>
              </select>
            </label>

            <button type="button" className="acquisitions-refresh" onClick={chargerMouvements}>
              Actualiser
            </button>
          </div>

          {erreurMouvements && <div className="admin-alert error">{erreurMouvements}</div>}

          <div className="acquisitions-summary">
            <strong>{mouvements.length}</strong>
            <span>mouvement(s) affiché(s), maximum 1 000</span>
          </div>

          {chargementMouvements ? (
            <p>Chargement des mouvements...</p>
          ) : mouvements.length === 0 ? (
            <p className="acquisitions-empty">Aucun mouvement ne correspond aux filtres sélectionnés.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table acquisitions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Collaborateur</th>
                    <th>Équipe</th>
                    <th>Période</th>
                    <th>Type</th>
                    <th>Jours</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {mouvements.map((mouvement) => {
                    const types: Record<MouvementConge["transaction_type"], string> = {
                      accrual: "Acquisition automatique",
                      adjustment: "Ajustement manuel",
                      leave_taken: "Congés pris",
                      reversal: "Régularisation",
                    };

                    return (
                      <tr key={mouvement.id}>
                        <td>{new Date(mouvement.created_at).toLocaleDateString("fr-FR")}</td>
                        <td><strong>{mouvement.first_name} {mouvement.last_name}</strong></td>
                        <td>{mouvement.team_name || "Sans équipe"}</td>
                        <td>
                          {mouvement.period_month
                            ? `${String(mouvement.period_month).padStart(2, "0")}/${mouvement.year}`
                            : mouvement.year}
                        </td>
                        <td><span className={`acquisitions-type type-${mouvement.transaction_type}`}>{types[mouvement.transaction_type]}</span></td>
                        <td className={Number(mouvement.amount) >= 0 ? "acquisitions-positive" : "acquisitions-negative"}>
                          {Number(mouvement.amount) > 0 ? "+" : ""}
                          {Number(mouvement.amount).toFixed(2)}
                        </td>
                        <td>{mouvement.description || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading admin-users-heading">
            <div>
              <span className="admin-eyebrow">GESTION DES ACCÈS</span>
              <h2>Collaborateurs</h2>
              <p>Affectez chaque collaborateur à son équipe.</p>
            </div>
            <input
              className="admin-search"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Rechercher un collaborateur..."
            />
          </div>

          {chargement ? (
            <p>Chargement des collaborateurs...</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Collaborateur</th>
                    <th>Adresse e-mail</th>
                    <th>Date d'arrivée</th>
                    <th>Équipe</th>
                    <th>Rôle</th>
                  </tr>
                </thead>
                <tbody>
                  {utilisateursFiltres.map((utilisateur) => (
                    <tr key={utilisateur.id}>
                      <td>
                        <div className="admin-user-name">
                          <span className="admin-avatar">
                            {utilisateur.first_name.charAt(0)}
                            {utilisateur.last_name.charAt(0)}
                          </span>
                          <strong>
                            {utilisateur.first_name} {utilisateur.last_name}
                          </strong>
                        </div>
                      </td>
                      <td className="admin-email">{utilisateur.email}</td>
                      <td>
                        <input
                          type="date"
                          className="admin-team-select"
                          value={utilisateur.hire_date?.slice(0, 10) ?? ""}
                          disabled={enregistrement === utilisateur.id}
                          onChange={(event) =>
                            modifierDateArrivee(utilisateur.id, event.target.value)
                          }
                        />
                      </td>
                      <td>
                        {utilisateur.id === 3 ? (
                          <span className="admin-protected-team">
                            {utilisateur.team_name || "Non affecté"}
                          </span>
                        ) : (
                          <select
                            className="admin-team-select"
                            value={utilisateur.team_id ?? ""}
                            disabled={enregistrement === utilisateur.id}
                            onChange={(event) =>
                              modifierEquipe(utilisateur.id, event.target.value)
                            }
                          >
                            <option value="" disabled>
                              Choisir une équipe
                            </option>
                            {equipes.map((equipe) => (
                              <option key={equipe.id} value={equipe.id}>
                                {equipe.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        {utilisateur.role === "admin" ? (
                          <span className="admin-role admin">
                            Administrateur
                          </span>
                        ) : (
                          <select
                            className="admin-team-select"
                            value={utilisateur.role}
                            disabled={enregistrement === utilisateur.id}
                            onChange={(event) =>
                              modifierRole(utilisateur.id, event.target.value)
                            }
                          >
                            <option value="employee">Employé</option>
                            <option value="manager">Manager</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                  {utilisateursFiltres.length === 0 && (
                    <tr>
                      <td colSpan={5} className="admin-empty">
                        Aucun collaborateur trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default Administration;
