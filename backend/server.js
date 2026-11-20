const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const pool = require("./db");
const argon2 = require("argon2");
const session = require("express-session");
const PostgreSQLStore = require("connect-pg-simple")(session);

const calculerJoursOuvrables = require("./utils/calculerJoursOuvrables");
const repartirJoursParAnnee = require("./utils/repartirJoursParAnnee");

const app = express();
const PORT = process.env.PORT || 3000;

// Sécurisation des en-têtes HTTP
app.use(helmet());

// Analyse des requêtes JSON (limite de 10 Ko)
app.use(express.json({ limit: "10kb" }));

// ==========================================
// CONFIGURATION DES SESSIONS
// ==========================================

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET manquant dans le fichier .env");
}

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(session({
    store: new PostgreSQLStore({
        pool: pool,
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 8
    }
}));


// ==========================================
// CONVERSION DES DATES FRANÇAISES
// ==========================================

function convertirDateEnISO(dateFr) {
    if (typeof dateFr !== "string") {
        return null;
    }

    const correspondance = dateFr.match(/^(\d{2})-(\d{2})-(\d{4})$/);

    if (!correspondance) {
        return null;
    }

    const [, jour, mois, annee] = correspondance;

    const date = new Date(
        Number(annee),
        Number(mois) - 1,
        Number(jour)
    );

    if (
        date.getFullYear() !== Number(annee) ||
        date.getMonth() !== Number(mois) - 1 ||
        date.getDate() !== Number(jour)
    ) {
        return null;
    }

    return `${annee}-${mois}-${jour}`;
}


// ==========================================
// VÉRIFICATION DE LA CONNEXION
// ==========================================

function verifierConnexion(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Vous devez être connecté."
        });
    }

    next();
}


// ==========================================
async function verifierManager(req, res, next) {
    try {
        const resultat = await pool.query(
            `SELECT
                u.role,
                EXISTS (
                    SELECT 1
                    FROM teams t
                    WHERE t.manager_id = u.id
                ) AS est_responsable
             FROM users u
             WHERE u.id = $1`,
            [req.session.user.id]
        );

        const utilisateur = resultat.rows[0];

        if (!utilisateur) {
            return res.status(401).json({ message: "Utilisateur introuvable." });
        }

        if (utilisateur.role === "admin") return next();

        if (utilisateur.role !== "manager" || !utilisateur.est_responsable) {
            return res.status(403).json({
                message: "Accès réservé aux responsables d'équipe et administrateurs."
            });
        }

        next();
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Vérification des droits impossible." });
    }
}

// ==========================================
// TEST DE L'API
// ==========================================

app.get("/api/test", (req, res) => {
    res.json({
        message: "Notre API fonctionne !",
        application: "Gestion des congés",
        version: "1.0.0"
    });
});


// ==========================================
// INSCRIPTION
// ==========================================

app.post("/api/inscription", async (req, res) => {
    try {
        const { first_name, last_name, email, password } = req.body;

        if (
            typeof first_name !== "string" ||
            typeof last_name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !first_name.trim() ||
            !last_name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Tous les champs sont obligatoires."
            });
        }
        if (password.length < 12) {
            return res.status(400).json({
                message: "Le mot de passe doit contenir au moins 12 caractères."
            });
        }

        const emailNormalise = email.trim().toLowerCase();
        const passwordHash = await argon2.hash(password);

        const resultat = await pool.query(
            `INSERT INTO users
            (first_name, last_name, email, password_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING id, first_name, last_name, email, role`,
            [
                first_name.trim(),
                last_name.trim(),
                emailNormalise,
                passwordHash
            ]
        );

        res.status(201).json({
            message: "Inscription réussie !",
            utilisateur: resultat.rows[0]
        });

    } catch (erreur) {
        if (erreur.code === "23505") {
            return res.status(409).json({
                message: "Cette adresse e-mail est déjà utilisée."
            });
        }

        console.error("Erreur inscription :", erreur);

        res.status(500).json({
            message: "Impossible de créer le compte."
        });
    }
});


// ==========================================
// CONNEXION
// ==========================================

const limiteurConnexion = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        message: "Trop de tentatives de connexion. Réessaie dans 15 minutes."
    }
});

app.post("/api/connexion", limiteurConnexion, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "L'adresse e-mail et le mot de passe sont obligatoires."
            });
        }

        const emailNormalise = email.trim().toLowerCase();

        const resultat = await pool.query(
            `SELECT
                id,
                first_name,
                last_name,
                email,
                password_hash,
                role
            FROM users
            WHERE email = $1`,
            [emailNormalise]
        );

        const utilisateur = resultat.rows[0];

        if (
            !utilisateur ||
            !(await argon2.verify(utilisateur.password_hash, password))
        ) {
            return res.status(401).json({
                message: "Adresse e-mail ou mot de passe incorrect."
            });
        }

        // Renouvellement de la session après authentification
        req.session.regenerate((erreur) => {
            if (erreur) {
                console.error("Erreur de session :", erreur);

                return res.status(500).json({
                    message: "Impossible de créer la session."
                });
            }

            req.session.user = {
                id: utilisateur.id,
                first_name: utilisateur.first_name,
                last_name: utilisateur.last_name,
                email: utilisateur.email,
                role: utilisateur.role
            };

            req.session.save((erreurSauvegarde) => {
                if (erreurSauvegarde) {
                    console.error("Erreur sauvegarde session :", erreurSauvegarde);

                    return res.status(500).json({
                        message: "Impossible de sauvegarder la session."
                    });
                }

                res.json({
                    message: "Connexion réussie !",
                    utilisateur: req.session.user
                });
            });
        });

    } catch (erreur) {
        console.error("Erreur connexion :", erreur);

        res.status(500).json({
            message: "Impossible de se connecter."
        });
    }
});


// ==========================================
// UTILISATEUR CONNECTÉ
// ==========================================

app.get("/api/profil", verifierConnexion, (req, res) => {
    res.json({
        utilisateur: req.session.user
    });
});


// ==========================================
// DÉCONNEXION
// ==========================================

app.post("/api/deconnexion", (req, res) => {
    req.session.destroy((erreur) => {
        if (erreur) {
            return res.status(500).json({
                message: "Erreur lors de la déconnexion."
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            message: "Déconnexion réussie."
        });
    });
});


// ==========================================
// RÉCUPÉRATION DES CONGÉS DE L'UTILISATEUR
// ==========================================

app.get("/api/conges", verifierConnexion, async (req, res) => {
    try {
        const resultat = await pool.query(
            `SELECT
                id,
                TO_CHAR(start_date, 'DD-MM-YYYY') AS start_date,
                TO_CHAR(end_date, 'DD-MM-YYYY') AS end_date,
                leave_type,
                status,
                comment
            FROM leave_requests
            WHERE user_id = $1
            ORDER BY created_at DESC`,
            [req.session.user.id]
        );

        res.json(resultat.rows);

    } catch (erreur) {
        console.error("Erreur récupération congés :", erreur);

        res.status(500).json({
            message: "Erreur interne du serveur."
        });
    }
});



// ==========================================
// SOLDE DE CONGÉS DE L'UTILISATEUR
// ==========================================

app.get("/api/solde", verifierConnexion, async (req, res) => {
    try {
        const annee = new Date().getFullYear();
        const userId = req.session.user.id;

        const resultatSolde = await pool.query(
            `SELECT
                COALESCE(SUM(amount), 0) AS solde,
                COALESCE(SUM(
                    CASE
                        WHEN transaction_type IN ('accrual', 'adjustment')
                        THEN amount
                        ELSE 0
                    END
                ), 0) AS jours_acquis,
                GREATEST(0, -COALESCE(SUM(
                    CASE
                        WHEN transaction_type IN ('leave_taken', 'reversal')
                        THEN amount
                        ELSE 0
                    END
                ), 0)) AS jours_pris
             FROM leave_transactions
             WHERE user_id = $1 AND year = $2`,
            [userId, annee]
        );

        const resultatAttentes = await pool.query(
            `SELECT start_date::text AS start_date,
                    end_date::text AS end_date
             FROM leave_requests
             WHERE user_id = $1
               AND status = 'pending'
               AND leave_type = 'paid_leave'
               AND EXTRACT(YEAR FROM start_date) <= $2
               AND EXTRACT(YEAR FROM end_date) >= $2`,
            [userId, annee]
        );

        let joursReserves = 0;

        for (const demande of resultatAttentes.rows) {
            const repartition = repartirJoursParAnnee(
                demande.start_date,
                demande.end_date
            );
            joursReserves += repartition[annee] || 0;
        }

        const soldeComptable = Number(resultatSolde.rows[0].solde);

        res.json({
            annee,
            soldeComptable,
            joursAcquis: Number(resultatSolde.rows[0].jours_acquis),
            joursPris: Number(resultatSolde.rows[0].jours_pris),
            joursReserves,
            disponible: soldeComptable - joursReserves
        });

    } catch (erreur) {
        console.error("Erreur calcul du solde :", erreur);
        res.status(500).json({
            message: "Impossible de calculer le solde de congés."
        });
    }
});

// ==========================================
// CRÉATION D'UNE DEMANDE DE CONGÉS
// ==========================================

app.post("/api/conges", verifierConnexion, async (req, res) => {
    let client;

    try {
        const { start_date, end_date, comment } = req.body;

        if (!start_date || !end_date) {
            return res.status(400).json({
                message: "Les deux dates sont obligatoires."
            });
        }

        const dateDebutISO = convertirDateEnISO(start_date);
        const dateFinISO = convertirDateEnISO(end_date);

        if (!dateDebutISO || !dateFinISO) {
            return res.status(400).json({
                message: "Les dates doivent respecter le format JJ-MM-AAAA et être valides."
            });
        }

        if (dateFinISO < dateDebutISO) {
            return res.status(400).json({
                message: "La date de fin doit être après la date de début."
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const utilisateurId = req.session.user.id;

        // Verrouille le compte pour éviter les demandes simultanées.
        const utilisateur = await client.query(
            "SELECT id FROM users WHERE id = $1 FOR UPDATE",
            [utilisateurId]
        );

        if (utilisateur.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(401).json({
                message: "Utilisateur introuvable."
            });
        }

        // Refuse les périodes déjà commencées.
        const verificationDate = await client.query(
            "SELECT $1::date < CURRENT_DATE AS date_passee",
            [dateDebutISO]
        );

        if (verificationDate.rows[0].date_passee) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "Vous ne pouvez pas demander des congés dans le passé."
            });
        }

        // Empêche les chevauchements avec les demandes en attente ou approuvées.
        const chevauchement = await client.query(
            `SELECT id
             FROM leave_requests
             WHERE user_id = $1
               AND status IN ('pending', 'approved')
               AND start_date <= $3::date
               AND end_date >= $2::date
             LIMIT 1`,
            [utilisateurId, dateDebutISO, dateFinISO]
        );

        if (chevauchement.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                message: "Cette période chevauche une autre demande de congés."
            });
        }

        // Calcule les jours demandés pour chaque année.
        const joursParAnnee = repartirJoursParAnnee(
            dateDebutISO,
            dateFinISO
        );

        // Récupère les demandes payées encore en attente.
        const demandesEnAttente = await client.query(
            `SELECT start_date::text AS start_date,
                    end_date::text AS end_date
             FROM leave_requests
             WHERE user_id = $1
               AND status = 'pending'
               AND leave_type = 'paid_leave'`,
            [utilisateurId]
        );

        const reservations = {};

        for (const demande of demandesEnAttente.rows) {
            const jours = repartirJoursParAnnee(
                demande.start_date,
                demande.end_date
            );

            for (const [annee, nombreJours] of Object.entries(jours)) {
                reservations[annee] =
                    (reservations[annee] || 0) + nombreJours;
            }
        }

        // Vérifie le solde disponible année par année.
        for (const [annee, joursDemandes] of Object.entries(joursParAnnee)) {
            if (joursDemandes === 0) continue;

            const resultatSolde = await client.query(
                `SELECT COALESCE(SUM(amount), 0) AS solde
                 FROM leave_transactions
                 WHERE user_id = $1 AND year = $2`,
                [utilisateurId, Number(annee)]
            );

            const soldeAcquis = Number(resultatSolde.rows[0].solde);
            const joursReserves = reservations[annee] || 0;
            const soldeDisponible = soldeAcquis - joursReserves;

            if (soldeDisponible < joursDemandes) {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    message: `Solde insuffisant pour ${annee}.`,
                    annee: Number(annee),
                    soldeAcquis,
                    joursReserves,
                    soldeDisponible,
                    joursDemandes
                });
            }
        }

        // Enregistre la demande uniquement si toutes les vérifications passent.
        const resultat = await client.query(
            `INSERT INTO leave_requests
                (user_id, start_date, end_date, comment)
             VALUES ($1, $2, $3, $4)
             RETURNING id, start_date, end_date, status, comment`,
            [
                utilisateurId,
                dateDebutISO,
                dateFinISO,
                typeof comment === "string" ? comment.trim() : null
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            message: "Demande enregistrée avec succès !",
            demande: resultat.rows[0]
        });

    } catch (erreur) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackErreur) {
                console.error("Erreur lors du rollback :", rollbackErreur);
            }
        }

        console.error("Erreur création congés :", erreur);

        return res.status(500).json({
            message: "Impossible d'enregistrer la demande."
        });

    } finally {
        if (client) client.release();
    }
});

// ==========================================
// DÉMARRAGE DU SERVEUR
// ==========================================


app.get("/api/manager/conges", verifierConnexion, verifierManager, async (req, res) => {
    try {
        const utilisateur = await pool.query(
            `SELECT
                u.role,
                (
                    SELECT t.id
                    FROM teams t
                    WHERE t.manager_id = u.id
                ) AS managed_team_id
             FROM users u
             WHERE u.id = $1`,
            [req.session.user.id]
        );

        const profil = utilisateur.rows[0];

        if (!profil) {
            return res.status(401).json({ message: "Utilisateur introuvable." });
        }

        const estAdmin = profil.role === "admin";

        if (!estAdmin && !profil.managed_team_id) {
            return res.status(403).json({
                message: "Vous n'êtes responsable d'aucune équipe."
            });
        }

        const resultat = await pool.query(
            `SELECT lr.id, lr.user_id, u.first_name, u.last_name,
                    TO_CHAR(lr.start_date, 'DD-MM-YYYY') AS start_date,
                    TO_CHAR(lr.end_date, 'DD-MM-YYYY') AS end_date,
                    lr.leave_type, lr.status, lr.comment, lr.created_at,
                    COALESCE((
                        SELECT json_agg(json_build_object(
                            'first_name', autres.first_name,
                            'last_name', autres.last_name,
                            'start_date', TO_CHAR(autres_demande.start_date, 'DD-MM-YYYY'),
                            'end_date', TO_CHAR(autres_demande.end_date, 'DD-MM-YYYY')
                        ))
                        FROM leave_requests autres_demande
                        JOIN users autres ON autres.id = autres_demande.user_id
                        WHERE autres_demande.status = 'approved'
                          AND autres_demande.user_id <> lr.user_id
                          AND autres.team_id = u.team_id
                          AND autres_demande.start_date <= lr.end_date
                          AND autres_demande.end_date >= lr.start_date
                    ), '[]'::json) AS chevauchements
             FROM leave_requests lr
             JOIN users u ON u.id = lr.user_id
             WHERE ($1::boolean = TRUE OR EXISTS (
                SELECT 1
                FROM teams t
                WHERE t.id = u.team_id
                  AND t.manager_id = $2
             ))
             ORDER BY lr.created_at DESC`,
            [estAdmin, req.session.user.id]
        );

        res.json(resultat.rows);
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Erreur récupération des demandes." });
    }
});



// ==========================================
// ANNULATION D'UNE DEMANDE DE CONGÉS
// ==========================================


// Un employé peut demander l'annulation, mais pas la finaliser.
app.patch("/api/conges/:id/demander-annulation", verifierConnexion, async (req, res) => {
    let client;

    try {
        const demandeId = Number(req.params.id);

        if (!Number.isInteger(demandeId) || demandeId <= 0) {
            return res.status(400).json({ message: "Identifiant invalide." });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const resultat = await client.query(
            `SELECT id, user_id, status, start_date::text AS start_date
             FROM leave_requests
             WHERE id = $1
             FOR UPDATE`,
            [demandeId]
        );

        if (resultat.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Demande introuvable." });
        }

        const demande = resultat.rows[0];

        if (demande.user_id !== req.session.user.id) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Vous ne pouvez demander l'annulation que de vos propres congés."
            });
        }

        if (!["pending", "approved"].includes(demande.status)) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                message: "Cette demande ne peut pas faire l'objet d'une annulation."
            });
        }

        const date = await client.query(
            "SELECT $1::date <= CURRENT_DATE AS deja_commencee",
            [demande.start_date]
        );

        if (date.rows[0].deja_commencee) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                message: "Impossible de demander l'annulation de congés déjà commencés."
            });
        }

        await client.query(
            `UPDATE leave_requests
             SET cancellation_previous_status = status,
                 status = 'cancellation_requested'
             WHERE id = $1`,
            [demandeId]
        );

        await client.query("COMMIT");

        return res.json({
            message: "Votre demande d'annulation a été transmise à votre manager."
        });

    } catch (erreur) {
        if (client) {
            try { await client.query("ROLLBACK"); } catch {}
        }
        console.error("Erreur demande annulation :", erreur);
        return res.status(500).json({
            message: "Impossible d'envoyer la demande d'annulation."
        });
    } finally {
        if (client) client.release();
    }
});


// Seul un manager ou administrateur peut décider d'une annulation.
app.patch("/api/manager/conges/:id/annulation", verifierConnexion, verifierManager, async (req, res) => {
    let client;

    try {
        const demandeId = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(demandeId) || demandeId <= 0) {
            return res.status(400).json({ message: "Identifiant invalide." });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Décision invalide." });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const profilResultat = await client.query(
            `SELECT
                u.role,
                (
                    SELECT t.id
                    FROM teams t
                    WHERE t.manager_id = u.id
                ) AS managed_team_id
             FROM users u
             WHERE u.id = $1`,
            [req.session.user.id]
        );

        const profil = profilResultat.rows[0];

        if (!profil) {
            await client.query("ROLLBACK");
            return res.status(401).json({ message: "Utilisateur introuvable." });
        }

        const estAdmin = profil.role === "admin";

        if (!estAdmin && !profil.managed_team_id) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Vous n'êtes responsable d'aucune équipe."
            });
        }

        const resultatDemande = await client.query(
            `SELECT lr.id, lr.user_id, lr.status, lr.leave_type,
                    lr.cancellation_previous_status,
                    lr.start_date::text AS start_date,
                    lr.end_date::text AS end_date,
                    u.team_id
             FROM leave_requests lr
             JOIN users u ON u.id = lr.user_id
             WHERE lr.id = $1
             FOR UPDATE OF lr`,
            [demandeId]
        );

        if (resultatDemande.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Demande introuvable." });
        }

        const demande = resultatDemande.rows[0];

        if (!estAdmin && demande.team_id !== profil.managed_team_id) {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Demande hors de votre équipe." });
        }

        if (demande.user_id === req.session.user.id) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Vous ne pouvez pas décider de votre propre annulation."
            });
        }

        if (
            demande.status !== "cancellation_requested" ||
            !["pending", "approved"].includes(demande.cancellation_previous_status)
        ) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                message: "Aucune demande d'annulation en attente pour ce congé."
            });
        }

        // Verrouille le compte du salarié pendant le traitement du solde.
        await client.query(
            "SELECT id FROM users WHERE id = $1 FOR UPDATE",
            [demande.user_id]
        );

        let joursRembourses = 0;

        if (status === "approved") {
            // Un remboursement est nécessaire uniquement pour un congé
            // payé qui avait déjà été approuvé.
            if (
                demande.cancellation_previous_status === "approved" &&
                demande.leave_type === "paid_leave"
            ) {
                const joursAttendus = repartirJoursParAnnee(
                    demande.start_date,
                    demande.end_date
                );

                const debits = await client.query(
                    `SELECT year, SUM(amount) AS amount
                     FROM leave_transactions
                     WHERE leave_request_id = $1
                       AND transaction_type = 'leave_taken'
                     GROUP BY year`,
                    [demandeId]
                );

                const remboursements = await client.query(
                    `SELECT COUNT(*)::int AS nombre
                     FROM leave_transactions
                     WHERE leave_request_id = $1
                       AND transaction_type = 'reversal'`,
                    [demandeId]
                );

                if (remboursements.rows[0].nombre > 0) {
                    await client.query("ROLLBACK");
                    return res.status(409).json({
                        message: "Un remboursement existe déjà pour cette demande."
                    });
                }

                const debitsParAnnee = Object.fromEntries(
                    debits.rows.map(d => [Number(d.year), Number(d.amount)])
                );

                const annees = new Set([
                    ...Object.keys(joursAttendus),
                    ...Object.keys(debitsParAnnee)
                ]);

                for (const annee of annees) {
                    const attendu = Number(joursAttendus[annee] || 0);
                    const enregistre = Number(debitsParAnnee[annee] || 0);

                    if (Math.abs(enregistre + attendu) > 0.001) {
                        await client.query("ROLLBACK");
                        return res.status(409).json({
                            message: `Anomalie détectée dans les débits de congés pour ${annee}. Remboursement bloqué.`
                        });
                    }
                }

                for (const debit of debits.rows) {
                    const remboursement = await client.query(
                        `INSERT INTO leave_transactions
                            (user_id, leave_request_id, created_by, year,
                             amount, transaction_type, description)
                         VALUES ($1, $2, $3, $4, $5, 'reversal', $6)
                         ON CONFLICT (leave_request_id, year, transaction_type)
                         WHERE leave_request_id IS NOT NULL
                         DO NOTHING
                         RETURNING amount`,
                        [
                            demande.user_id,
                            demandeId,
                            req.session.user.id,
                            debit.year,
                            -Number(debit.amount),
                            `Remboursement après acceptation de l'annulation #${demandeId}`
                        ]
                    );

                    if (remboursement.rows.length > 0) {
                        joursRembourses += Number(remboursement.rows[0].amount);
                    }
                }
            }

            await client.query(
                `UPDATE leave_requests
                 SET status = 'cancelled',
                     cancellation_previous_status = NULL
                 WHERE id = $1`,
                [demandeId]
            );

        } else {
            // Refus : retour au statut antérieur, sans toucher au solde.
            await client.query(
                `UPDATE leave_requests
                 SET status = cancellation_previous_status,
                     cancellation_previous_status = NULL
                 WHERE id = $1`,
                [demandeId]
            );
        }

        await client.query(
            `INSERT INTO notifications (user_id, leave_request_id, type, message)
             VALUES ($1, $2, $3, $4)`,
            [
                demande.user_id,
                demandeId,
                status === "approved" ? "cancellation_approved" : "cancellation_rejected",
                status === "approved"
                    ? `Votre demande d'annulation du congé #${demandeId} a été acceptée.`
                    : `Votre demande d'annulation du congé #${demandeId} a été refusée.`
            ]
        );

        await client.query("COMMIT");

        return res.json({
            message: status === "approved"
                ? "Annulation acceptée. Le congé est annulé."
                : "Annulation refusée. Le statut initial du congé est rétabli.",
            status: status === "approved" ? "cancelled" : demande.cancellation_previous_status,
            joursRembourses
        });

    } catch (erreur) {
        if (client) {
            try { await client.query("ROLLBACK"); } catch {}
        }
        console.error("Erreur décision annulation :", erreur);
        return res.status(500).json({
            message: "Erreur lors du traitement de l'annulation."
        });
    } finally {
        if (client) client.release();
    }
});


app.patch("/api/manager/conges/:id", verifierConnexion, verifierManager, async (req, res) => {
    let client;

    try {
        client = await pool.connect();

        const demandeId = Number(req.params.id);
        const { status, comment } = req.body;

        if (!Number.isInteger(demandeId) || demandeId <= 0) {
            return res.status(400).json({ message: "Identifiant invalide." });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Statut invalide." });
        }

        await client.query("BEGIN");

        const utilisateur = await client.query(
            `SELECT
                u.role,
                (
                    SELECT t.id
                    FROM teams t
                    WHERE t.manager_id = u.id
                ) AS managed_team_id
             FROM users u
             WHERE u.id = $1`,
            [req.session.user.id]
        );

        const profil = utilisateur.rows[0];

        if (!profil) {
            await client.query("ROLLBACK");
            return res.status(401).json({ message: "Utilisateur introuvable." });
        }

        const estAdmin = profil.role === "admin";
        const teamId = profil.managed_team_id;

        if (!estAdmin && !teamId) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Vous n'êtes responsable d'aucune équipe."
            });
        }

        const demande = await client.query(
            `SELECT
                lr.id,
                lr.user_id,
                lr.status,
                lr.leave_type,
                lr.start_date::text AS start_date,
                lr.end_date::text AS end_date,
                u.team_id
             FROM leave_requests lr
             JOIN users u ON u.id = lr.user_id
             WHERE lr.id = $1
             FOR UPDATE OF lr`,
            [demandeId]
        );

        if (demande.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Demande introuvable." });
        }

        const demandeTrouvee = demande.rows[0];

        if (!estAdmin && demandeTrouvee.team_id !== teamId) {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Demande hors de votre équipe." });
        }

        if (demandeTrouvee.user_id === req.session.user.id) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Vous ne pouvez pas valider vos propres congés."
            });
        }

        if (demandeTrouvee.status !== "pending") {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "Demande déjà traitée." });
        }

        // Verrouille le collaborateur pour empêcher deux validations
        // simultanées de consommer le même solde.
        await client.query(
            "SELECT id FROM users WHERE id = $1 FOR UPDATE",
            [demandeTrouvee.user_id]
        );

        // Seuls les congés payés consomment le solde de congés payés.
        if (status === "approved" && demandeTrouvee.leave_type === "paid_leave") {
            const joursParAnnee = repartirJoursParAnnee(
                demandeTrouvee.start_date,
                demandeTrouvee.end_date
            );

            // Récupère les autres demandes en attente pour réserver leurs jours.
            const demandesEnAttente = await client.query(
                `SELECT start_date::text AS start_date,
                        end_date::text AS end_date
                 FROM leave_requests
                 WHERE user_id = $1
                   AND status = 'pending'
                   AND leave_type = 'paid_leave'
                   AND id <> $2`,
                [demandeTrouvee.user_id, demandeId]
            );

            const reservations = {};

            for (const demandeEnAttente of demandesEnAttente.rows) {
                const joursReserves = repartirJoursParAnnee(
                    demandeEnAttente.start_date,
                    demandeEnAttente.end_date
                );

                for (const [annee, jours] of Object.entries(joursReserves)) {
                    reservations[annee] = (reservations[annee] || 0) + jours;
                }
            }

            for (const [annee, joursDemandes] of Object.entries(joursParAnnee)) {
                if (joursDemandes === 0) continue;

                const soldeResultat = await client.query(
                    `SELECT COALESCE(SUM(amount), 0) AS solde
                     FROM leave_transactions
                     WHERE user_id = $1 AND year = $2`,
                    [demandeTrouvee.user_id, Number(annee)]
                );

                const soldeAcquis = Number(soldeResultat.rows[0].solde);
                const joursReserves = reservations[annee] || 0;
                const soldeDisponible = soldeAcquis - joursReserves;

                if (soldeDisponible < joursDemandes) {
                    await client.query("ROLLBACK");

                    return res.status(409).json({
                        message: `Solde insuffisant pour ${annee}.`,
                        annee: Number(annee),
                        soldeAcquis,
                        joursReserves,
                        soldeDisponible,
                        joursDemandes
                    });
                }
            }

            // Enregistre un débit négatif pour chaque année concernée.
            for (const [annee, jours] of Object.entries(joursParAnnee)) {
                if (jours === 0) continue;

                await client.query(
                    `INSERT INTO leave_transactions
                        (user_id, leave_request_id, created_by, year,
                         amount, transaction_type, description)
                     VALUES ($1, $2, $3, $4, $5, 'leave_taken', $6)`,
                    [
                        demandeTrouvee.user_id,
                        demandeId,
                        req.session.user.id,
                        Number(annee),
                        -jours,
                        `Congés payés approuvés - demande #${demandeId}`
                    ]
                );
            }
        }

        const resultat = await client.query(
            `UPDATE leave_requests
             SET status = $1,
                 reviewed_by = $2,
                 reviewed_at = CURRENT_TIMESTAMP,
                 comment = CASE
                     WHEN $3::text IS NOT NULL AND $3::text <> '' THEN $3
                     ELSE comment
                 END
             WHERE id = $4
             RETURNING id, status, reviewed_by, reviewed_at, comment`,
            [
                status,
                req.session.user.id,
                typeof comment === "string" ? comment.trim() : null,
                demandeId
            ]
        );

        await client.query(
            `INSERT INTO notifications (user_id, leave_request_id, type, message)
             VALUES ($1, $2, $3, $4)`,
            [
                demandeTrouvee.user_id,
                demandeId,
                status === "approved" ? "leave_approved" : "leave_rejected",
                status === "approved"
                    ? `Votre demande de congé #${demandeId} a été acceptée.`
                    : `Votre demande de congé #${demandeId} a été refusée.`
            ]
        );

        await client.query("COMMIT");

        res.json({
            message: status === "approved" ? "Demande acceptée." : "Demande refusée.",
            demande: resultat.rows[0]
        });

    } catch (erreur) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackErreur) {
                console.error("Erreur lors du rollback :", rollbackErreur);
            }
        }

        console.error(erreur);
        res.status(500).json({ message: "Erreur lors du traitement." });

    } finally {
        if (client) client.release();
    }
});

// ==========================================

// NOTIFICATIONS

// ==========================================
// CALENDRIER DES CONGÉS
// ==========================================

app.get("/api/calendrier", verifierConnexion, async (req, res) => {
    try {
        const mois = req.query.mois;

        if (typeof mois !== "string" || !/^\d{4}-\d{2}$/.test(mois)) {
            return res.status(400).json({ message: "Mois invalide." });
        }

        const debutMois = `${mois}-01`;
        const profilResultat = await pool.query(
            "SELECT id, role FROM users WHERE id = $1",
            [req.session.user.id]
        );

        const profil = profilResultat.rows[0];

        if (!profil) {
            return res.status(401).json({ message: "Utilisateur introuvable." });
        }

        let conditionAcces;
        let parametres;

        if (profil.role === "admin") {
            conditionAcces = "TRUE";
            parametres = [debutMois];
        } else if (profil.role === "manager") {
            conditionAcces = `EXISTS (
                SELECT 1
                FROM teams t
                WHERE t.id = u.team_id
                  AND t.manager_id = $2
            )`;
            parametres = [debutMois, profil.id];
        } else {
            conditionAcces = "lr.user_id = $2";
            parametres = [debutMois, profil.id];
        }

        const resultat = await pool.query(
            `SELECT
                lr.id,
                lr.user_id,
                u.first_name,
                u.last_name,
                TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
                lr.leave_type,
                lr.status
             FROM leave_requests lr
             JOIN users u ON u.id = lr.user_id
             WHERE ${conditionAcces}
               AND lr.status IN ('approved', 'pending', 'cancellation_requested')
               AND lr.start_date <= (
                    $1::date + INTERVAL '1 month - 1 day'
               )::date
               AND lr.end_date >= $1::date
             ORDER BY lr.start_date, u.last_name`,
            parametres
        );

        res.json(resultat.rows);
    } catch (erreur) {
        console.error("Erreur calendrier :", erreur);
        res.status(500).json({ message: "Impossible de charger le calendrier." });
    }
});

app.get("/api/notifications", verifierConnexion, async (req, res) => {
    try {
        const resultat = await pool.query(
            `SELECT id, leave_request_id, type, message, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 30`,
            [req.session.user.id]
        );
        const nonLues = await pool.query(
            `SELECT COUNT(*)::int AS total FROM notifications
             WHERE user_id = $1 AND is_read = FALSE`,
            [req.session.user.id]
        );
        res.json({ notifications: resultat.rows, nonLues: nonLues.rows[0].total });
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Erreur de chargement." });
    }
});

app.patch("/api/notifications/:id/lue", verifierConnexion, async (req, res) => {
    try {
        const resultat = await pool.query(
            `UPDATE notifications SET is_read = TRUE
             WHERE id = $1 AND user_id = $2 RETURNING id`,
            [Number(req.params.id), req.session.user.id]
        );
        if (!resultat.rowCount) return res.status(404).json({ message: "Introuvable." });
        res.json({ message: "Notification lue." });
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Erreur." });
    }
});

app.patch("/api/notifications/lire-tout", verifierConnexion, async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = TRUE
             WHERE user_id = $1 AND is_read = FALSE`,
            [req.session.user.id]
        );
        res.json({ message: "Notifications lues." });
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Erreur." });
    }
});

// ADMINISTRATION - SUPER-ADMINISTRATEUR
// ==========================================

async function verifierAdmin(req, res, next) {
    try {
        const resultat = await pool.query(
            "SELECT role FROM users WHERE id = $1",
            [req.session.user.id]
        );

        if (resultat.rows[0]?.role !== "admin") {
            return res.status(403).json({
                message: "Accès réservé au super-administrateur."
            });
        }

        next();
    } catch (erreur) {
        console.error("Erreur vérification administrateur :", erreur);
        res.status(500).json({ message: "Erreur de vérification des droits." });
    }
}



// Paramètres d'acquisition des congés — réservé à l'administrateur
app.get("/api/admin/parametres-conges", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const resultat = await pool.query(
            `SELECT monthly_accrual, accrual_day
             FROM leave_settings
             WHERE id = 1`
        );

        if (resultat.rows.length === 0) {
            return res.status(404).json({ message: "Les paramètres de congés sont introuvables." });
        }

        res.json(resultat.rows[0]);
    } catch (erreur) {
        console.error("Erreur lecture paramètres congés :", erreur);
        res.status(500).json({ message: "Impossible de récupérer les paramètres de congés." });
    }
});

app.put("/api/admin/parametres-conges", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const monthlyAccrual = Number(req.body.monthly_accrual);
        const accrualDay = Number(req.body.accrual_day);

        if (
            !Number.isFinite(monthlyAccrual) ||
            monthlyAccrual <= 0 ||
            monthlyAccrual > 999.99 ||
            Math.round(monthlyAccrual * 100) !== monthlyAccrual * 100
        ) {
            return res.status(400).json({
                message: "Le nombre de jours acquis doit être compris entre 0,01 et 999,99, avec deux décimales maximum."
            });
        }

        if (!Number.isInteger(accrualDay) || accrualDay < 1 || accrualDay > 28) {
            return res.status(400).json({
                message: "Le jour d'acquisition doit être un nombre entier entre 1 et 28."
            });
        }

        const resultat = await pool.query(
            `UPDATE leave_settings
             SET monthly_accrual = $1,
                 accrual_day = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = 1
             RETURNING monthly_accrual, accrual_day`,
            [monthlyAccrual, accrualDay]
        );

        if (resultat.rows.length === 0) {
            return res.status(404).json({ message: "Les paramètres de congés sont introuvables." });
        }

        res.json({
            message: "Paramètres de congés enregistrés.",
            parametres: resultat.rows[0]
        });
    } catch (erreur) {
        console.error("Erreur modification paramètres congés :", erreur);
        res.status(500).json({ message: "Impossible d'enregistrer les paramètres de congés." });
    }
});



app.get("/api/admin/historique-acquisitions/:id/details", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const runId = Number(req.params.id);

        if (!Number.isInteger(runId) || runId <= 0) {
            return res.status(400).json({ message: "Identifiant invalide." });
        }

        const resultat = await pool.query(
            `SELECT id, user_id, user_name, amount, status, message, created_at
             FROM leave_accrual_run_details
             WHERE run_id = $1
             ORDER BY user_name`,
            [runId]
        );

        res.json(resultat.rows);
    } catch (erreur) {
        console.error("Erreur détails acquisition :", erreur);
        res.status(500).json({ message: "Impossible de charger les détails." });
    }
});

// Statistiques globales des acquisitions — réservé à l'administrateur
app.get("/api/admin/statistiques-acquisitions", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const resultat = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'success') AS executions_reussies,
                COUNT(*) FILTER (WHERE status = 'error') AS executions_erreur,
                COALESCE(SUM(duplicates_ignored), 0) AS doublons_evites,
                COALESCE(SUM(days_credited), 0) AS jours_acquis
            FROM leave_accrual_runs
        `);

        res.json(resultat.rows[0]);
    } catch (erreur) {
        console.error("Erreur statistiques acquisitions :", erreur);
        res.status(500).json({
            message: "Impossible de récupérer les statistiques des acquisitions."
        });
    }
});

// Journal des acquisitions automatiques — réservé à l'administrateur
app.get("/api/admin/historique-acquisitions", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const resultat = await pool.query(
            `SELECT id, started_at, finished_at, period_year, period_month,
                    status, credits_count, days_credited, duplicates_ignored, message
             FROM leave_accrual_runs
             ORDER BY started_at DESC, id DESC
             LIMIT 100`
        );
        res.json(resultat.rows);
    } catch (erreur) {
        console.error("Erreur historique acquisitions :", erreur);
        res.status(500).json({ message: "Impossible de récupérer l'historique des acquisitions." });
    }
});

// Historique des mouvements de congés — réservé à l'administrateur
app.get("/api/admin/transactions", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const conditions = [];
        const valeurs = [];

        if (req.query.userId) {
            const userId = Number(req.query.userId);
            if (!Number.isInteger(userId) || userId <= 0) {
                return res.status(400).json({ message: "Identifiant de collaborateur invalide." });
            }
            valeurs.push(userId);
            conditions.push(`lt.user_id = $${valeurs.length}`);
        }

        if (req.query.annee) {
            const annee = Number(req.query.annee);
            if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
                return res.status(400).json({ message: "Année invalide." });
            }
            valeurs.push(annee);
            conditions.push(`lt.year = $${valeurs.length}`);
        }

        const typesAutorises = ["accrual", "adjustment", "leave_taken", "reversal"];
        if (req.query.type && req.query.type !== "all") {
            if (!typesAutorises.includes(req.query.type)) {
                return res.status(400).json({ message: "Type de mouvement invalide." });
            }
            valeurs.push(req.query.type);
            conditions.push(`lt.transaction_type = $${valeurs.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const resultat = await pool.query(
            `SELECT
                lt.id,
                lt.user_id,
                u.first_name,
                u.last_name,
                t.name AS team_name,
                lt.year,
                lt.period_month,
                lt.amount,
                lt.transaction_type,
                lt.description,
                lt.created_at
             FROM leave_transactions lt
             JOIN users u ON u.id = lt.user_id
             LEFT JOIN teams t ON t.id = u.team_id
             ${where}
             ORDER BY lt.created_at DESC, lt.id DESC
             LIMIT 1000`,
            valeurs
        );

        res.json(resultat.rows);
    } catch (erreur) {
        console.error("Erreur historique des transactions :", erreur);
        res.status(500).json({ message: "Impossible de récupérer les mouvements de congés." });
    }
});

// Liste des utilisateurs
app.get("/api/admin/utilisateurs", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const resultat = await pool.query(`
            SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                   u.team_id, u.hire_date, t.name AS team_name
            FROM users u
            LEFT JOIN teams t ON t.id = u.team_id
            ORDER BY u.last_name, u.first_name
        `);

        res.json(resultat.rows);
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Impossible de récupérer les utilisateurs." });
    }
});

// Liste des équipes
app.get("/api/admin/equipes", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const resultat = await pool.query(
            `SELECT t.id, t.name, t.manager_id,
                    u.first_name AS manager_first_name,
                    u.last_name AS manager_last_name
             FROM teams t
             LEFT JOIN users u ON u.id = t.manager_id
             ORDER BY t.name`
        );

        res.json(resultat.rows);
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Impossible de récupérer les équipes." });
    }
});

// Affectation d'un utilisateur à une équipe
app.patch("/api/admin/utilisateurs/:id/equipe", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const teamId = Number(req.body.team_id);

        if (!Number.isInteger(userId) || userId <= 0 ||
            !Number.isInteger(teamId) || teamId <= 0) {
            return res.status(400).json({ message: "Identifiant invalide." });
        }

        if (userId === req.session.user.id) {
            return res.status(400).json({
                message: "Vous ne pouvez pas modifier votre propre équipe ici."
            });
        }

        const equipe = await pool.query(
            "SELECT id FROM teams WHERE id = $1",
            [teamId]
        );

        if (equipe.rows.length === 0) {
            return res.status(404).json({ message: "Équipe introuvable." });
        }

        await pool.query(
            "UPDATE teams SET manager_id = NULL WHERE manager_id = $1 AND id <> $2",
            [userId, teamId]
        );

        const resultat = await pool.query(
            `UPDATE users SET team_id = $1
             WHERE id = $2
             RETURNING id, first_name, last_name, email, team_id`,
            [teamId, userId]
        );

        if (resultat.rows.length === 0) {
            return res.status(404).json({ message: "Utilisateur introuvable." });
        }

        res.json({
            message: "Équipe mise à jour.",
            utilisateur: resultat.rows[0]
        });
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Impossible de modifier l'équipe." });
    }
});

// Désignation du responsable d'une équipe
app.patch("/api/admin/equipes/:id/responsable", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const equipeId = Number(req.params.id);
        const managerId = req.body.manager_id === null || req.body.manager_id === ""
            ? null
            : Number(req.body.manager_id);

        if (!Number.isInteger(equipeId) || equipeId <= 0) {
            return res.status(400).json({ message: "Identifiant d'équipe invalide." });
        }

        if (managerId !== null && (!Number.isInteger(managerId) || managerId <= 0)) {
            return res.status(400).json({ message: "Identifiant du responsable invalide." });
        }

        const equipe = await pool.query(
            "SELECT id FROM teams WHERE id = $1",
            [equipeId]
        );

        if (equipe.rows.length === 0) {
            return res.status(404).json({ message: "Équipe introuvable." });
        }

        if (managerId !== null) {
            const candidat = await pool.query(
                "SELECT id FROM users WHERE id = $1 AND role = 'manager' AND team_id = $2",
                [managerId, equipeId]
            );

            if (candidat.rows.length === 0) {
                return res.status(400).json({
                    message: "Le responsable doit avoir le rôle manager et appartenir à cette équipe."
                });
            }
        }

        const resultat = await pool.query(
            "UPDATE teams SET manager_id = $1 WHERE id = $2 RETURNING id, name, manager_id",
            [managerId, equipeId]
        );

        res.json({
            message: managerId === null
                ? "Responsable retiré de l'équipe."
                : "Responsable désigné avec succès.",
            equipe: resultat.rows[0]
        });
    } catch (erreur) {
        if (erreur.code === "23505") {
            return res.status(409).json({
                message: "Ce collaborateur est déjà responsable d'une autre équipe."
            });
        }
        console.error(erreur);
        res.status(500).json({ message: "Impossible de désigner le responsable." });
    }
});

// Création d'une équipe
app.post("/api/admin/equipes", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const nom = typeof req.body.name === "string" ? req.body.name.trim() : "";

        if (nom.length < 2 || nom.length > 80) {
            return res.status(400).json({
                message: "Le nom doit contenir entre 2 et 80 caractères."
            });
        }

        const resultat = await pool.query(
            "INSERT INTO teams (name) VALUES ($1) RETURNING id, name",
            [nom]
        );

        res.status(201).json(resultat.rows[0]);
    } catch (erreur) {
        if (erreur.code === "23505") {
            return res.status(409).json({ message: "Cette équipe existe déjà." });
        }

        console.error(erreur);
        res.status(500).json({ message: "Impossible de créer l'équipe." });
    }
});


// Renommer une équipe
app.patch("/api/admin/equipes/:id", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const equipeId = Number(req.params.id);
        const nom = typeof req.body.name === "string" ? req.body.name.trim() : "";

        if (!Number.isInteger(equipeId) || equipeId <= 0) {
            return res.status(400).json({ message: "Identifiant d'équipe invalide." });
        }

        if (nom.length < 2 || nom.length > 80) {
            return res.status(400).json({
                message: "Le nom doit contenir entre 2 et 80 caractères."
            });
        }

        const resultat = await pool.query(
            "UPDATE teams SET name = $1 WHERE id = $2 RETURNING id, name",
            [nom, equipeId]
        );

        if (resultat.rows.length === 0) {
            return res.status(404).json({ message: "Équipe introuvable." });
        }

        res.json(resultat.rows[0]);
    } catch (erreur) {
        if (erreur.code === "23505") {
            return res.status(409).json({ message: "Une équipe porte déjà ce nom." });
        }
        console.error(erreur);
        res.status(500).json({ message: "Impossible de renommer l'équipe." });
    }
});

// Supprimer une équipe uniquement si elle est vide
app.delete("/api/admin/equipes/:id", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const equipeId = Number(req.params.id);

        if (!Number.isInteger(equipeId) || equipeId <= 0) {
            return res.status(400).json({ message: "Identifiant d'équipe invalide." });
        }

        const membres = await pool.query(
            "SELECT COUNT(*)::int AS nombre FROM users WHERE team_id = $1",
            [equipeId]
        );

        if (membres.rows[0].nombre > 0) {
            return res.status(409).json({
                message: `Impossible de supprimer cette équipe : ${membres.rows[0].nombre} collaborateur(s) y sont encore affectés.`
            });
        }

        const resultat = await pool.query(
            "DELETE FROM teams WHERE id = $1 RETURNING id",
            [equipeId]
        );

        if (resultat.rowCount === 0) {
            return res.status(404).json({ message: "Équipe introuvable." });
        }

        res.json({ message: "Équipe supprimée." });
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Impossible de supprimer l'équipe." });
    }
});

// Modification du rôle d'un utilisateur
app.patch("/api/admin/utilisateurs/:id/role", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const role = req.body.role;

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ message: "Identifiant invalide." });
        }

        if (!["employee", "manager"].includes(role)) {
            return res.status(400).json({
                message: "Le rôle doit être employé ou manager."
            });
        }

        const utilisateur = await pool.query(
            "SELECT id, role FROM users WHERE id = $1",
            [userId]
        );

        if (utilisateur.rows.length === 0) {
            return res.status(404).json({ message: "Utilisateur introuvable." });
        }

        if (utilisateur.rows[0].role === "admin") {
            return res.status(403).json({
                message: "Impossible de modifier le rôle d'un administrateur."
            });
        }

        if (role !== "manager") {
            await pool.query(
                "UPDATE teams SET manager_id = NULL WHERE manager_id = $1",
                [userId]
            );
        }

        const resultat = await pool.query(
            `UPDATE users SET role = $1
             WHERE id = $2
             RETURNING id, first_name, last_name, email, role`,
            [role, userId]
        );

        res.json({
            message: "Rôle mis à jour avec succès.",
            utilisateur: resultat.rows[0]
        });

    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Impossible de modifier le rôle." });
    }
});

// Création d'un collaborateur depuis l'administration

// Modification de la date d'arrivée d'un collaborateur
app.patch("/api/admin/utilisateurs/:id/date-arrivee", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { hire_date } = req.body;

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ message: "Identifiant invalide." });
        }

        if (
            typeof hire_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(hire_date)
        ) {
            return res.status(400).json({ message: "Date d'arrivée invalide." });
        }

        const date = new Date(`${hire_date}T12:00:00Z`);

        if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== hire_date
        ) {
            return res.status(400).json({ message: "Date d'arrivée invalide." });
        }

        const resultat = await pool.query(
            `UPDATE users
             SET hire_date = $1
             WHERE id = $2
             RETURNING id, first_name, last_name, hire_date`,
            [hire_date, userId]
        );

        if (resultat.rows.length === 0) {
            return res.status(404).json({ message: "Utilisateur introuvable." });
        }

        res.json({
            message: "Date d'arrivée mise à jour.",
            utilisateur: resultat.rows[0]
        });
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({ message: "Impossible de modifier la date d'arrivée." });
    }
});

app.post("/api/admin/utilisateurs", verifierConnexion, verifierAdmin, async (req, res) => {
    try {
        const { first_name, last_name, email, password, role, team_id, hire_date } = req.body;

        if (
            typeof first_name !== "string" ||
            typeof last_name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            typeof hire_date !== "string" ||
            !first_name.trim() ||
            !last_name.trim() ||
            !email.trim() ||
            !password ||
            !hire_date.trim()
        ) {
            return res.status(400).json({
                message: "Tous les champs sont obligatoires."
            });
        }

        if (password.length < 12) {
            return res.status(400).json({
                message: "Le mot de passe doit contenir au moins 12 caractères."
            });
        }

        if (!["employee", "manager"].includes(role)) {
            return res.status(400).json({
                message: "Le rôle doit être employé ou manager."
            });
        }

        const teamId = Number(team_id);

        if (!Number.isInteger(teamId) || teamId <= 0) {
            return res.status(400).json({
                message: "Veuillez sélectionner une équipe valide."
            });
        }

        const equipe = await pool.query(
            "SELECT id FROM teams WHERE id = $1",
            [teamId]
        );

        if (equipe.rows.length === 0) {
            return res.status(404).json({
                message: "Équipe introuvable."
            });
        }

        const emailNormalise = email.trim().toLowerCase();
        const passwordHash = await argon2.hash(password);

        const resultat = await pool.query(
            `INSERT INTO users
                (first_name, last_name, email, password_hash, role, team_id, hire_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, first_name, last_name, email, role, team_id, hire_date`,
            [
                first_name.trim(),
                last_name.trim(),
                emailNormalise,
                passwordHash,
                role,
                teamId,
                hire_date
            ]
        );

        res.status(201).json({
            message: "Collaborateur créé avec succès.",
            utilisateur: resultat.rows[0]
        });

    } catch (erreur) {
        if (erreur.code === "23505") {
            return res.status(409).json({
                message: "Cette adresse e-mail est déjà utilisée."
            });
        }

        console.error("Erreur création collaborateur :", erreur);

        res.status(500).json({
            message: "Impossible de créer le collaborateur."
        });
    }
});


// ==========================================
// ACQUISITION AUTOMATIQUE DES CONGÉS
// ==========================================

const cron = require("node-cron");
const attribuerCongesMensuels = require("./utils/attribuerCongesMensuels");

async function lancerAcquisitionMensuelle() {
    const debut = new Date();

    try {
        const resultat = await attribuerCongesMensuels();

        const nombreErreurs = resultat.erreurs ?? 0;

        const statut = resultat.ignore
            ? "ignored"
            : nombreErreurs > 0
                ? "error"
                : "success";

        const message = resultat.ignore
            ? resultat.raison
            : nombreErreurs > 0
                ? `Acquisition partielle : ${resultat.creditsEffectues} collaborateur(s) crédité(s), ${Number(resultat.joursCredites).toFixed(2)} jour(s), ${nombreErreurs} erreur(s).`
                : `Acquisition terminée : ${resultat.creditsEffectues} collaborateur(s), ${Number(resultat.joursCredites).toFixed(2)} jour(s).`;

        const insertionRun = await pool.query(
            `INSERT INTO leave_accrual_runs
                (started_at, finished_at, period_year, period_month, status,
                 credits_count, days_credited, duplicates_ignored, message)
             VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                debut,
                resultat.annee ?? null,
                resultat.mois ?? null,
                statut,
                resultat.creditsEffectues ?? 0,
                resultat.joursCredites ?? 0,
                resultat.doublonsIgnores ?? 0,
                message
            ]
        );

        const runId = insertionRun.rows[0].id;

        for (const detail of resultat.details ?? []) {
            await pool.query(
                `INSERT INTO leave_accrual_run_details
                    (run_id, user_id, user_name, amount, status, message)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    runId,
                    detail.utilisateurId,
                    detail.nom || `Collaborateur #${detail.utilisateurId}`,
                    detail.joursCredites ?? 0,
                    detail.statut || "credited",
                    detail.message || null
                ]
            );
        }

        console.log("Acquisition mensuelle :", JSON.stringify(resultat));
    } catch (erreur) {
        console.error("Erreur acquisition mensuelle :", erreur);

        try {
            await pool.query(
                `INSERT INTO leave_accrual_runs
                    (started_at, finished_at, status, message)
                 VALUES ($1, CURRENT_TIMESTAMP, 'error', $2)`,
                [debut, String(erreur.message || erreur)]
            );
        } catch (erreurJournal) {
            console.error("Impossible d'écrire l'erreur dans le journal :", erreurJournal);
        }
    }
}

// Vérification au démarrage du serveur.
lancerAcquisitionMensuelle();

// Exécution chaque premier du mois à 03 h 05.
// Vérification quotidienne : le script ne crédite que le jour configuré.
cron.schedule("5 3 * * *", () => {
    lancerAcquisitionMensuelle();
}, {
    timezone: "Europe/Paris"
});

// ==========================================
// FRONTEND REACT
// ==========================================

const frontendPath = path.resolve(__dirname, "../frontend/dist");

app.use(express.static(frontendPath));

app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
        return next();
    }

    res.sendFile(path.join(frontendPath, "index.html"), (erreur) => {
        if (erreur) next(erreur);
    });
});

// ==========================================
// DÉMARRAGE DU SERVEUR
// ==========================================

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
