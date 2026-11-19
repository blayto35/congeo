import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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

function Layout() {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [menuNotifications, setMenuNotifications] = useState(false);
  const navigate = useNavigate();

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

    chargerNotifications();
    const intervalle = window.setInterval(chargerNotifications, 30000);

    return () => window.clearInterval(intervalle);
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
    return <p className="layout-loading">Chargement...</p>;
  }

  if (!utilisateur) return null;

  return (
    <>
      <header className="main-navigation">
        <NavLink to="/dashboard" className="navigation-brand">
          Conge<span>o</span>
        </NavLink>

        <nav className="navigation-links">
          <NavLink to="/dashboard">Mon espace</NavLink>
          <NavLink to="/historique">Historique</NavLink>
          <NavLink to="/calendrier">Calendrier</NavLink>

          {(utilisateur.role === "manager" ||
            utilisateur.role === "admin") && (
            <NavLink to="/manager">Gestion des congés</NavLink>
          )}

          {utilisateur.role === "admin" && (
            <NavLink to="/administration">Administration</NavLink>
          )}
        </nav>

        <div className="navigation-user">
          <div className="notification-container">
            <button
              className="notification-button"
              onClick={() => setMenuNotifications(!menuNotifications)}
              aria-label="Notifications"
              aria-expanded={menuNotifications}
            >
              🔔
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
                    <button onClick={toutMarquerCommeLu}>
                      Tout lire
                    </button>
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
                            {
                              dateStyle: "short",
                              timeStyle: "short",
                            }
                          )}
                        </small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <span>
            {utilisateur.first_name} {utilisateur.last_name}
          </span>
          <button onClick={deconnexion}>Déconnexion</button>
        </div>
      </header>

      <Outlet />
    </>
  );
}

export default Layout;
