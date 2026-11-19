# Congeo – Gestion des congés

Application web de gestion des congés permettant aux collaborateurs de déposer leurs demandes, aux responsables de les traiter et aux administrateurs de piloter les paramètres de l'organisation.

## Fonctionnalités

### Collaborateurs

- Création d'un compte et authentification.
- Consultation du solde de congés.
- Dépôt et suivi des demandes de congés.
- Demande d'annulation d'un congé.
- Consultation de l'historique personnel.
- Visualisation du calendrier.

### Responsables

- Consultation des demandes de leur équipe.
- Validation ou refus des demandes.
- Gestion des demandes d'annulation.
- Alertes en cas de chevauchement de congés.
- Visualisation des effectifs dans le calendrier.

### Administrateurs

- Gestion des utilisateurs et des rôles.
- Gestion des équipes et de leurs responsables.
- Configuration de l'acquisition mensuelle des congés.
- Consultation de l'historique des acquisitions.
- Consultation des statistiques d'acquisition.

### Gestion des congés

- Calcul des jours ouvrés.
- Prise en compte des jours fériés français.
- Suivi comptable des acquisitions, consommations et régularisations.
- Prévention des doubles acquisitions mensuelles.

## Technologies

**Frontend**

- React
- TypeScript
- Vite
- CSS

**Backend**

- Node.js
- Express
- PostgreSQL
- Argon2 pour le hachage des mots de passe
- Express Session pour les sessions utilisateurs
- Helmet et Express Rate Limit pour renforcer la sécurité
- Node Cron pour les tâches planifiées
- Date Holidays pour les jours fériés

**Infrastructure**

- Docker
- Docker Compose

## Prérequis

- Node.js 22 ou supérieur
- npm
- Docker
- Docker Compose

## Installation

### 1. Récupérer le projet

```bash
git clone URL_DU_DEPOT
cd gestion-conges
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Modifier ensuite le fichier `.env` avec :

- Un secret de session long et aléatoire.
- Un mot de passe PostgreSQL robuste.
- Les paramètres de connexion à la base de données.

Ne jamais publier le fichier `.env`.

### 3. Installer les dépendances du backend

```bash
cd backend
npm install
cd ..
```

### 4. Installer les dépendances du frontend

```bash
cd frontend
npm install
cd ..
```

### 5. Démarrer PostgreSQL

Depuis la racine du projet :

```bash
docker compose up -d
```

### 6. Démarrer le backend

Dans un terminal :

```bash
cd backend
node server.js
```

### 7. Démarrer le frontend

Dans un second terminal :

```bash
cd frontend
npm run dev
```

L'application est alors accessible à l'adresse :

http://localhost:5173

## Sécurité

Le projet intègre notamment :

- Le hachage des mots de passe avec Argon2.
- Une gestion des sessions côté serveur.
- Des protections HTTP avec Helmet.
- Une limitation des tentatives de connexion.
- Des contrôles d'accès selon les rôles.
- Des validations côté serveur.

## Démonstration

Ce dépôt a vocation à présenter un projet de démonstration et un travail de développement.

Pour toute démonstration publique, utiliser exclusivement des comptes et des données fictifs.

## Auteur

Projet personnel réalisé dans le cadre d'un parcours de formation en développement informatique (BTS SIO – option SLAM).
