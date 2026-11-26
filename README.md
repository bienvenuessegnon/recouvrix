# Recouvrix — Plateforme SaaS de gestion intelligente du recouvrement

Recouvrix est une application SaaS professionnelle conçue pour les PME afin d'optimiser le suivi des factures impayées, d'automatiser la priorisation des créances et de sécuriser les encaissements.

---

## 1. Problème métier traité & Proposition de valeur

Dans de nombreuses entreprises, le recouvrement des créances souffre de factures oubliées, de relances tardives, d'informations éparpillées et d'un manque de visibilité sur les promesses de paiement et les justificatifs reçus.

**Recouvrix apporte une solution unifiée :**
- **Centralisation et traçabilité** : Chaque facture, client, paiement et relance est rattaché à un dossier unique.
- **Priorisation intelligente** : L'intelligence artificielle (Gemini) analyse le portefeuille pour mettre en avant les dossiers critiques, les litiges et les promesses échues.
- **Règlement et quittance officielle** : Vérification humaine des paiements déclarés, génération automatique de justificatifs de paiement officiels (PDF) et mise à jour en temps réel des soldes.
- **Sécurité et conformité** : Isolation par organisation, rôles stricts (Administrateur et Gestionnaire), et traçabilité horodatée de toutes les opérations.

---

## 2. Fonctionnalités principales

1. **Tableau de bord de pilotage** : KPIs financiers en temps réel (créances ouvertes, en retard, taux de recouvrement, paiements en attente), priorités du jour et recommandations de l'IA.
2. **Gestion des clients** : Coordonnées, préférences de communication (Email, WhatsApp, Téléphone), et historique consolidé.
3. **Factures et créances** : Suivi des échéances, calculs de retard, gestion des litiges, promesses de règlement et avoirs commerciaux.
4. **Importation assistée** : Intégration de fichiers CSV, Excel ou factures PDF avec détection des doublons et contrôle préalable avant validation.
5. **Relances multicanales** : Préparation de messages par Email ou WhatsApp avec assistance rédactionnelle IA et validation humaine obligatoire.
6. **Contrôle des paiements & Justificatifs** : Déclaration de règlements, rapprochement des preuves de virement ou Mobile Money, confirmation avec émission d'un justificatif de paiement et copie de facture marquée « PAYÉE » si soldée.
7. **Paramètres et Audit** : Configuration légale et bancaire de l'organisation, gestion des utilisateurs et journal des événements de sécurité.

---

## 3. Architecture technique

- **Frontend** : React 19, TypeScript, Tailwind CSS, composants UI sur mesure et graphiques interactifs.
- **Backend & API** : Node.js / Express (`server.ts`) avec authentification Bearer (scrypt + sessions en mémoire à TTL), génération de documents PDF et appels sécurisés au SDK `@google/genai` (Gemini).
- **Stockage (démo)** : portefeuille métier en mémoire dans le processus Node (réinitialisé au redémarrage). Un backend FastAPI + PostgreSQL existe sous `backend/` pour une trajectoire production, mais n’est pas démarré par `npm run dev` / `npm start`.

---

## 4. Prérequis et installation locale

### Prérequis
- Node.js (v20 ou supérieur, v22 recommandé pour SQLite intégré)
- npm ou bun

### Installation
1. Cloner le dépôt et installer les dépendances :
   ```bash
   npm install
   ```
2. Configurer les variables d'environnement (copier `.env.example` vers `.env`) :
   ```bash
   cp .env.example .env
   ```
3. Lancer le serveur de développement (frontend + API) :
   ```bash
   npm run dev
   ```
4. Accéder à l'application dans le navigateur sur `http://localhost:3847`.

### Connexion démo
- **Créer un compte** depuis l’écran Connexion (stocké en SQLite `data/recouvrix-demo.sqlite`).
- Comptes démo `admin@recouvrix.demo` / `gestionnaire@recouvrix.demo` uniquement si vous définissez `DEMO_ADMIN_PASSWORD` et `DEMO_MANAGER_PASSWORD`.
- Fichiers de test : `/api/demo/sample/sample_creances.csv` et `/api/demo/sample/sample_portefeuille_entree.pdf`.

### Déploiement

**Option A — tout-en-un Render** (API + UI)  
1. Pousser sur GitHub (`bienvenuessegnon/recouvrix`).  
2. Web Service Node : build `npm ci && npm run build`, start `npm start`, health `/api/health`.  
3. Secrets : `DEMO_ADMIN_PASSWORD`, `DEMO_MANAGER_PASSWORD`, optionnellement `GEMINI_API_KEY`.

**Option B — frontend Vercel + API Render**  
1. API sur Render (comme ci-dessus).  
2. Projet Vercel (`vercel.json`) : build Vite → `dist`.  
3. Variable `VITE_API_BASE_URL=https://recouvrix-saas.onrender.com` (Production + Preview).  
4. Sur Render, optionnel : `CORS_ORIGINS=https://votre-app.vercel.app`.

### Améliorations produit (pitch)

- Interface 100 % métier : la documentation des composants UI n’est plus exposée dans l’application.
- Recherche universelle globale (`⌘/Ctrl + K`) depuis n’importe quel écran.
- Bloc « Actions prioritaires du jour » en tête du tableau de bord + filtre de période (30 jours / Trimestre / Année).
- Timeline visuelle du cycle de vie sur la fiche facture + menu Actions regroupé.
- Aperçu WYSIWYG de l’email client dans le tiroir de relance.

---

## 5. Comptes de démonstration

Deux comptes de présentation sont prévus :
- **Directeur Financier (Administrateur)** : `admin@recouvrix.demo`
- **Gestionnaire de recouvrement** : `gestionnaire@recouvrix.demo`

Les mots de passe sont **obligatoires** via les secrets d’environnement
`DEMO_ADMIN_PASSWORD` et `DEMO_MANAGER_PASSWORD` (Cursor, Render, `.env` local).
Il n’existe plus d’initialisation publique des mots de passe.

---

## 6. Scénario de démonstration

1. **Connexion** : Initialiser les mots de passe si demandé, puis s’authentifier (gestionnaire ou admin).
2. **Tableau de bord** : Consulter les indicateurs financiers et les priorités recommandées.
3. **Importation** : Tester l'importation d'un fichier de créances et observer la détection des doublons.
4. **Relance** : Ouvrir une facture échue, préparer une relance et générer le brouillon assisté par IA.
5. **Paiement et Justificatif** : Déclarer un règlement, joindre un justificatif, vérifier l'opération dans le tiroir de contrôle, confirmer l'encaissement et télécharger le justificatif officiel de paiement.
6. **Journal** : Consulter l'historique horodaté des actions et l'audit de sécurité.

---

## 7. Sécurité & Limites connues

- **Authentification** : mots de passe hachés (scrypt), sessions Bearer aléatoires avec expiration, téléchargements PDF protégés.
- **Secrets** : `GEMINI_API_KEY`, `DEMO_*_PASSWORD`, `SESSION_SECRET` / Postgres via variables d’environnement uniquement (voir `docker-compose.yml` — aucun secret en clair, Postgres non exposé sur l’hôte).
- **Jetons navigateur** : conservés en mémoire (pas de `localStorage`).
- **Limites connues** : pas d’envoi SMTP réel (copie manuelle / PDF) ; données métier non persistées dans le runtime Node de démo.
