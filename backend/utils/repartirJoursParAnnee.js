const calculerJoursOuvrables = require("./calculerJoursOuvrables");

function repartirJoursParAnnee(dateDebut, dateFin) {
    const debut = new Date(`${dateDebut}T12:00:00Z`);
    const fin = new Date(`${dateFin}T12:00:00Z`);

    if (
        Number.isNaN(debut.getTime()) ||
        Number.isNaN(fin.getTime()) ||
        debut > fin ||
        debut.toISOString().slice(0, 10) !== dateDebut ||
        fin.toISOString().slice(0, 10) !== dateFin
    ) {
        throw new Error("Période de congés invalide.");
    }

    const resultats = {};
    let annee = debut.getUTCFullYear();

    while (annee <= fin.getUTCFullYear()) {
        const debutAnnee = `${annee}-01-01`;
        const finAnnee = `${annee}-12-31`;

        const debutPeriode = dateDebut > debutAnnee ? dateDebut : debutAnnee;
        const finPeriode = dateFin < finAnnee ? dateFin : finAnnee;

        resultats[annee] = calculerJoursOuvrables(debutPeriode, finPeriode);

        annee++;
    }

    return resultats;
}

module.exports = repartirJoursParAnnee;
