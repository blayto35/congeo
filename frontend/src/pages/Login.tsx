import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur("");
    setChargement(true);

    try {
      const response = await fetch("/api/connexion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErreur(data.message || "Erreur de connexion.");
        return;
      }

      navigate("/dashboard");
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          <img src="/favicon.svg" alt="Logo Congeo" />
          <span>Conge<span className="brand-accent">o</span></span>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">ESPACE PERSONNEL</p>
          <h1>Bon retour !</h1>
          <p>Connectez-vous pour gérer vos congés.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            type="email"
            placeholder="vous@entreprise.fr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            placeholder="Votre mot de passe"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {erreur && <p className="error-message">{erreur}</p>}

          <button type="submit" disabled={chargement}>
            {chargement ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="auth-footer">
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </section>

      <aside className="auth-decoration">
        <div className="decoration-content">
          <span className="decoration-label">UNE GESTION PLUS SIMPLE</span>
          <h2>Le temps libre mérite d'être bien organisé.</h2>
          <p>
            Retrouvez vos demandes, votre solde et les absences de votre équipe
            au même endroit.
          </p>
          <div className="decoration-shape">✳</div>
        </div>
        <span className="decoration-bottom">CONGEO · GESTION DES CONGÉS</span>
      </aside>
    </main>
  );
}

export default Login;
