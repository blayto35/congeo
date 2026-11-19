import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur("");
    setChargement(true);

    try {
      const reponse = await fetch("/api/inscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          first_name: prenom,
          last_name: nom,
          email,
          password: motDePasse,
        }),
      });

      const donnees = await reponse.json();

      if (!reponse.ok) {
        throw new Error(donnees.message || donnees.error || "Impossible de créer le compte.");
      }

      navigate("/connexion");
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <main className="register-page">
      <section className="register-card">
        <Link to="/connexion" className="register-brand">Congeo</Link>

        <h1>Créer un compte</h1>
        <p className="register-subtitle">
          Rejoignez votre espace de gestion des congés.
        </p>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="register-fields-row">
            <label>
              Prénom
              <input
                type="text"
                value={prenom}
                onChange={(event) => setPrenom(event.target.value)}
                required
              />
            </label>

            <label>
              Nom
              <input
                type="text"
                value={nom}
                onChange={(event) => setNom(event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Adresse e-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Mot de passe
            <input
              type="password"
              value={motDePasse}
              onChange={(event) => setMotDePasse(event.target.value)}
              minLength={12}
              required
            />
            <small>12 caractères minimum.</small>
          </label>

          {erreur && <p className="register-error">{erreur}</p>}

          <button type="submit" disabled={chargement}>
            {chargement ? "Création en cours..." : "Créer mon compte"}
          </button>
        </form>

        <p className="register-footer">
          Déjà un compte ? <Link to="/connexion">Se connecter</Link>
        </p>
      </section>
    </main>
  );
}

export default Register;
