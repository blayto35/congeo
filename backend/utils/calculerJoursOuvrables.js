const Holidays = require("date-holidays");

const joursFeries = new Holidays("FR");

function convertirDate(dateTexte) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTexte)) {
        throw new Error("Format de date invalide. Format attendu : AAAA-MM-JJ.");
    }

    const date = new Date(`${dateTexte}T12:00:00Z`);

    if (date.toISOString().slice(0, 10) !== dateTexte) {
        throw new Error("Date invalide.");
    }

    return date;
}

function calculerJoursOuvrables(dateDebutTexte, dateFinTexte) {
    const debut = convertirDate(dateDebutTexte);
    const fin = convertirDate(dateFinTexte);

    if (debut > fin) {
        throw new Error("La date de début doit précéder la date de fin.");
    }

    let total = 0;

    for (
        let date = new Date(debut);
        date <= fin;
        date.setUTCDate(date.getUTCDate() + 1)
    ) {
        const jourSemaine = date.getUTCDay();
        const estWeekend = jourSemaine === 0 || jourSemaine === 6;
        const estFerie = Boolean(joursFeries.isHoliday(date));

        if (!estWeekend && !estFerie) {
            total++;
        }
    }

    return total;
}

module.exports = calculerJoursOuvrables;
