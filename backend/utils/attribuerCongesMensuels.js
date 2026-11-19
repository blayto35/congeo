const pool = require("../db");

/**
 * Calcule les jours acquis au prorata des jours calendaires.
 * Le calcul est effectué en centièmes pour éviter les erreurs d'arrondi.
 */
function calculerAcquisition(montantMensuel, dateArrivee, debutMois, finMois) {
    const debutAcquisition =
        dateArrivee > debutMois ? dateArrivee : debutMois;

    if (debutAcquisition > finMois) {
        return 0;
    }

    const joursDansLeMois =
        finMois.getUTCDate();

    const joursEligibles =
        Math.floor((finMois - debutAcquisition) / 86400000) + 1;

    return Math.round(
        (Number(montantMensuel) * joursEligibles / joursDansLeMois) * 100
    ) / 100;
}

function convertirDateISO(dateTexte) {
    const date = new Date(`${dateTexte}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dateTexte
    ) {
        throw new Error(`Date invalide : ${dateTexte}`);
    }

    return date;
}

/**
 * Attribue les congés du mois précédent.
 *
 * referenceDate permet de tester le traitement sur une date précise.
 * Exemple : attribuerCongesMensuels(new Date("2026-12-01T00:00:00Z"))
 */
async function attribuerCongesMensuels(referenceDate = new Date(), options = {}) {
    const dryRun = options.dryRun === true;

    // On utilise explicitement la date française, indépendamment du fuseau
    // horaire configuré sur la machine qui héberge le serveur.
    const partiesDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(referenceDate);

    const obtenirPartie = (type) =>
        Number(partiesDate.find((partie) => partie.type === type).value);

    const anneeCourante = obtenirPartie("year");
    const moisCourant = obtenirPartie("month");
    const jourCourant = obtenirPartie("day");

    const parametres = await pool.query(
        `SELECT monthly_accrual, accrual_day
         FROM leave_settings
         WHERE id = 1`
    );

    if (parametres.rows.length === 0) {
        throw new Error("Les paramètres de congés sont introuvables.");
    }

    const montantMensuel = Number(parametres.rows[0].monthly_accrual);
    const jourAcquisition = Number(parametres.rows[0].accrual_day);

    // Le traitement ne fait rien en dehors du jour configuré.
    if (jourCourant !== jourAcquisition) {
        return {
            ignore: true,
            raison: `Aujourd'hui nous sommes le ${jourCourant}, le crédit est prévu le ${jourAcquisition}.`,
            jourAcquisition
        };
    }

    // Le jour configuré du mois courant crédite le mois précédent.
    const dateReference = new Date(
        Date.UTC(anneeCourante, moisCourant - 1, 1)
    );

    const finMoisPrecedent = new Date(
        dateReference.getTime() - 86400000
    );

    const annee = finMoisPrecedent.getUTCFullYear();
    const mois = finMoisPrecedent.getUTCMonth() + 1;

    const debutMois = new Date(
        Date.UTC(annee, mois - 1, 1)
    );

    const finMois = new Date(
        Date.UTC(annee, mois, 0)
    );

    const utilisateurs = await pool.query(
        `SELECT id, first_name, last_name, hire_date
         FROM users
         WHERE role IN ('employee', 'manager')
           AND hire_date IS NOT NULL
           AND hire_date <= $1
         ORDER BY id`,
        [finMois.toISOString().slice(0, 10)]
    );

    const resultats = {
        annee,
        mois,
        creditsEffectues: 0,
        doublonsIgnores: 0,
        erreurs: 0,
        joursCredites: 0,
        details: []
    };

    for (const utilisateur of utilisateurs.rows) {
        const dateArriveeTexte = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Paris",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(utilisateur.hire_date);

        const dateArrivee = convertirDateISO(dateArriveeTexte);

        const montant = calculerAcquisition(
            montantMensuel,
            dateArrivee,
            debutMois,
            finMois
        );

        if (montant <= 0) {
            continue;
        }

        if (dryRun) {
            const dejaCredite = await pool.query(
                `SELECT 1
                 FROM leave_transactions
                 WHERE user_id = $1
                   AND year = $2
                   AND period_month = $3
                   AND transaction_type = 'accrual'`,
                [utilisateur.id, annee, mois]
            );

            if (dejaCredite.rows.length > 0) {
                resultats.doublonsIgnores++;
                resultats.details.push({
                    utilisateurId: utilisateur.id,
                    nom: `${utilisateur.first_name} ${utilisateur.last_name}`,
                    joursCredites: 0,
                    statut: "duplicate",
                    message: "Acquisition déjà enregistrée."
                });
                continue;
            }

            resultats.creditsEffectues++;
            resultats.joursCredites += montant;
            resultats.details.push({
                utilisateurId: utilisateur.id,
                joursCredites: montant,
                simulation: true
            });
            continue;
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // L'index unique empêche tout double crédit.
            const insertion = await client.query(
                `INSERT INTO leave_transactions
                    (user_id, year, period_month, amount,
                     transaction_type, description)
                 VALUES ($1, $2, $3, $4, 'accrual', $5)
                 ON CONFLICT (user_id, year, period_month)
                 WHERE transaction_type = 'accrual'
                 DO NOTHING
                 RETURNING id`,
                [
                    utilisateur.id,
                    annee,
                    mois,
                    montant,
                    `Acquisition automatique des congés de ${String(mois).padStart(2, "0")}/${annee}`
                ]
            );

            if (insertion.rows.length === 0) {
                await client.query("ROLLBACK");
                resultats.doublonsIgnores++;
                resultats.details.push({
                    utilisateurId: utilisateur.id,
                    nom: `${utilisateur.first_name} ${utilisateur.last_name}`,
                    joursCredites: 0,
                    statut: "duplicate",
                    message: "Acquisition déjà enregistrée."
                });
                continue;
            }

            await client.query(
                `INSERT INTO leave_balances
                    (user_id, year, acquired_days, updated_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id, year)
                 DO UPDATE SET
                    acquired_days = leave_balances.acquired_days + EXCLUDED.acquired_days,
                    updated_at = CURRENT_TIMESTAMP`,
                [utilisateur.id, annee, montant]
            );

            await client.query("COMMIT");

            resultats.creditsEffectues++;
            resultats.joursCredites += montant;
            resultats.details.push({
                utilisateurId: utilisateur.id,
                nom: `${utilisateur.first_name} ${utilisateur.last_name}`,
                joursCredites: montant,
                statut: "credited",
                message: "Crédit effectué avec succès."
            });

        } catch (erreur) {
            try {
                await client.query("ROLLBACK");
            } catch (erreurRollback) {
                console.error("Erreur lors du rollback :", erreurRollback);
            }

            resultats.erreurs++;
            resultats.details.push({
                utilisateurId: utilisateur.id,
                nom: `${utilisateur.first_name} ${utilisateur.last_name}`,
                joursCredites: 0,
                statut: "error",
                message: erreur.message || "Erreur inconnue."
            });

            console.error(
                `Erreur d'acquisition pour ${utilisateur.first_name} ${utilisateur.last_name} :`,
                erreur
            );
        } finally {
            client.release();
        }
    }

    return resultats;
}

module.exports = attribuerCongesMensuels;
module.exports.calculerAcquisition = calculerAcquisition;
