const express = require("express");

const app = express();

app.use(express.json());

const PORT = 3000;

app.get("/", (req, res) => {
res.send("Notre application de gestion des congés est en construction !");});

app.get("/api/test", (req, res) => {
    res.json({
        message: "Notre API fonctionne !",
        application: "Gestion des congés",
        version: "1.0.0"
    });
});

app.post("/api/conges", (req, res) => {
    const demande = req.body;

    console.log("Nouvelle demande reçue :", demande);

    res.status(201).json({
        message: "Demande de congés reçue !",
        demande: demande
    });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});