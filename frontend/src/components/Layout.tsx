import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import "./Layout.css";

interface Utilisateur {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
}

interface Notification {
  id: number;
  leave_request_id: number | null;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const pages: Record<string, { titre: string; description: string }> = {
  "/dashboard": {
    titre: "Mon espace",
    description: "Retrouvez toutes les informations concernant vos congés.",
  },
  "/historique": {
    titre: "Historique",
    description: "Consultez et retrouvez vos demandes de congés.",
  },
  "/calendrier": {
    titre: "Calendrier",
    description: "Visualisez les absences et les périodes à venir.",
  },
  "/manager": {
    titre: "Gestion des congés",
    description: "Suivez et traitez les demandes de votre équipe.",
  },
  "/administration": {
    titre: "Administration",
    description: "Gérez les utilisateurs et les paramètres de votre organisation.",
  },
};

function Layout() {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [menuNotifications, setMenuNotifications] = useState(false);
  const [organisation, setOrganisation] = useState({ name: "Mon organisation", logoUrl: null as string | null });
  const [versionPhoto, setVersionPhoto] = useState(Date.now());
  const [photoChargee, setPhotoChargee] = useState(false);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState("");
  const inputPhotoRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const chargerNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        credentials: "include",
      });

      if (!response.ok) return;

      const data = await response.json();
      setNotifications(data.notifications);
      setNonLues(data.nonLues);
    } catch (error) {
      console.error("Erreur notifications :", error);
    }
  }, []);

  useEffect(() => {
    async function chargerProfil() {
      try {
        const response = await fetch("/api/profil", {
          credentials: "include",
        });

        if (!response.ok) {
          navigate("/connexion");
          return;
        }

        const data = await response.json();
        setUtilisateur(data.utilisateur);
      } catch (error) {
        console.error("Erreur de chargement du profil :", error);
        navigate("/connexion");
      } finally {
        setChargement(false);
      }
    }

    chargerProfil();
  }, [navigate]);

  useEffect(() => {
    if (!utilisateur) return;

    async function chargerOrganisation() {
      try {
        const response = await fetch("/api/organisation", { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        setOrganisation({
          name: data.name || "Mon organisation",
          logoUrl: data.logoUrl || null,
        });
      } catch (error) {
        console.error("Erreur de chargement de l'organisation :", error);
      }
    }

    chargerOrganisation();
    window.addEventListener("organisation-updated", chargerOrganisation);

    chargerNotifications();
    const intervalle = window.setInterval(chargerNotifications, 30000);

    return () => {
      window.removeEventListener("organisation-updated", chargerOrganisation);
      window.clearInterval(intervalle);
    };
  }, [utilisateur, chargerNotifications]);

  async function marquerCommeLue(id: number) {
    try {
      await fetch(`/api/notifications/${id}/lue`, {
        method: "PATCH",
        credentials: "include",
      });
      await chargerNotifications();
    } catch (error) {
      console.error("Erreur lecture notification :", error);
    }
  }

  async function toutMarquerCommeLu() {
    try {
      await fetch("/api/notifications/lire-tout", {
        method: "PATCH",
        credentials: "include",
      });
      await chargerNotifications();
    } catch (error) {
      console.error("Erreur lecture notifications :", error);
    }
  }

  async function deconnexion() {
    try {
      await fetch("/api/deconnexion", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      navigate("/connexion");
    }
  }

  if (chargement) {
    return <div className="layout-loading">Chargement de votre espace...</div>;
  }

  if (!utilisateur) return null;

  const page = pages[location.pathname] ?? {
    titre: "Congeo",
    description: "Votre espace de gestion des congés.",
  };

  const initiales = `${utilisateur.first_name.charAt(0)}${utilisateur.last_name.charAt(0)}`.toUpperCase();

  async function changerPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0];
    event.target.value = "";
    setErreurPhoto("");

    if (!fichier) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(fichier.type)) {
      setErreurPhoto("Choisissez une image JPEG, PNG ou WebP.");
      return;
    }

    if (fichier.size > 2 * 1024 * 1024) {
      setErreurPhoto("La photo ne doit pas dépasser 2 Mo.");
      return;
    }

    setEnvoiPhoto(true);

    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => {
          const resultat = String(lecteur.result || "");
          resolve(resultat.split(",")[1] || "");
        };
        lecteur.onerror = () => reject(new Error("Lecture de l'image impossible."));
        lecteur.readAsDataURL(fichier);
      });

      const response = await fetch("/api/profil/photo", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: fichier.type }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Enregistrement impossible.");

      setVersionPhoto(Date.now());
    } catch (error) {
      setErreurPhoto(error instanceof Error ? error.message : "Erreur lors de l'envoi.");
    } finally {
      setEnvoiPhoto(false);
    }
  }

  const navigation = [
    {
      titre: "ESPACE PERSONNEL",
      liens: [
        { to: "/dashboard", label: "Mon espace", icon: "⌂" },
        { to: "/historique", label: "Historique", icon: "◷" },
        { to: "/calendrier", label: "Calendrier", icon: "▦" },
      ],
    },
    ...((utilisateur.role === "manager" || utilisateur.role === "admin")
      ? [{
          titre: "GESTION",
          liens: [
            { to: "/manager", label: "Gestion des congés", icon: "⇄" },
          ],
        }]
      : []),
    ...(utilisateur.role === "admin"
      ? [{
          titre: "ORGANISATION",
          liens: [
            { to: "/administration", label: "Administration", icon: "⚙" },
          ],
        }]
      : []),
  ];

  return (
    <div className="congeo-layout">
      <aside className="congeo-sidebar">
        <NavLink to="/dashboard" className="congeo-brand">
          <span className="congeo-brand-logo">
            <img src={organisation.logoUrl || "/favicon.svg"} alt="" />
          </span>
          <span className="congeo-brand-name">
            {organisation.name}
            <small>GESTION DES CONGÉS</small>
          </span>
        </NavLink>

        <div className="sidebar-organization">
          <span className="organization-icon">✦</span>
          <span>
            <strong>{organisation.name}</strong>
            <small>Espace collaborateur</small>
          </span>
          <span className="organization-chevron">⌄</span>
        </div>

        <nav className="congeo-navigation">
          {navigation.map((groupe) => (
            <div className="navigation-group" key={groupe.titre}>
              <span className="navigation-group-title">{groupe.titre}</span>
              {groupe.liens.map((lien) => (
                <NavLink
                  key={lien.to}
                  to={lien.to}
                  className={({ isActive }) =>
                    `congeo-nav-link ${isActive ? "active" : ""}`
                  }
                >
                  <span className="nav-link-icon">{lien.icon}</span>
                  <span>{lien.label}</span>
                  {lien.to === "/manager" && nonLues > 0 && (
                    <span className="nav-link-count">{nonLues}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-icon">?</span>
            <div>
              <strong>Besoin d'aide ?</strong>
              <small>Contactez votre administrateur.</small>
            </div>
          </div>

          <div className="sidebar-version">CONGEO <span>•</span> ESPACE SÉCURISÉ</div>
        </div>
      </aside>

      <div className="congeo-main">
        <header className="congeo-topbar">
          <div className="topbar-context">
            <span className="topbar-breadcrumb">ESPACE DE TRAVAIL</span>
            <span className="topbar-separator">/</span>
            <span className="topbar-current">{page.titre}</span>
          </div>

          <div className="topbar-actions">
            <div className="notification-container">
              <button
                className="notification-button"
                onClick={() => setMenuNotifications(!menuNotifications)}
                aria-label="Notifications"
                aria-expanded={menuNotifications}
              >
                <span aria-hidden="true">🔔</span>
                {nonLues > 0 && (
                  <span className="notification-badge">
                    {nonLues > 99 ? "99+" : nonLues}
                  </span>
                )}
              </button>

              {menuNotifications && (
                <div className="notification-panel">
                  <div className="notification-heading">
                    <strong>Notifications</strong>
                    {nonLues > 0 && (
                      <button onClick={toutMarquerCommeLu}>Tout lire</button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <p className="notification-empty">
                      Aucune notification pour le moment.
                    </p>
                  ) : (
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          className={`notification-item ${
                            notification.is_read ? "read" : "unread"
                          }`}
                          onClick={() => marquerCommeLue(notification.id)}
                        >
                          <span>{notification.message}</span>
                          <small>
                            {new Date(notification.created_at).toLocaleString(
                              "fr-FR",
                              { dateStyle: "short", timeStyle: "short" }
                            )}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="topbar-divider" />

            <div className="topbar-profile">
              <input
                ref={inputPhotoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={changerPhoto}
              />
              <button
                type="button"
                className="profile-avatar profile-avatar-button"
                onClick={() => inputPhotoRef.current?.click()}
                disabled={envoiPhoto}
                title="Changer ma photo de profil"
                aria-label="Changer ma photo de profil"
              >
                <img
                  key={versionPhoto}
                  src={`/api/profil/photo?v=${versionPhoto}`}
                  alt=""
                  onLoad={() => setPhotoChargee(true)}
                  onError={() => setPhotoChargee(false)}
                />
                {!photoChargee && <span>{initiales}</span>}
              </button>
              <div className="profile-identity">
                <strong>{utilisateur.first_name} {utilisateur.last_name}</strong>
                <small>
                  {utilisateur.role === "admin"
                    ? "Administrateur"
                    : utilisateur.role === "manager"
                    ? "Manager"
                    : "Collaborateur"}
                </small>
              </div>
            </div>
            {erreurPhoto && (
              <span role="alert" className="profile-photo-error">
                {erreurPhoto}
              </span>
            )}

            <button
              className="logout-button"
              onClick={deconnexion}
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <span aria-hidden="true">⇥</span>
              <span className="logout-label">Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="congeo-workspace">
          <div className="workspace-heading">
            <div>
              <h1>{page.titre}</h1>
              <p>{page.description}</p>
            </div>
            <div className="workspace-date">
              <span>●</span> Espace sécurisé
            </div>
          </div>

          <div className="workspace-content">
            <Outlet />
          </div>

          <footer className="congeo-footer">
            <span>© {new Date().getFullYear()} Congeo</span>
            <span>Gestion des congés · Tous droits réservés</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Layout;
