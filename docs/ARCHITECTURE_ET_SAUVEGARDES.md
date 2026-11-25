# Architecture Technique, Migrations et Sauvegardes — Recouvrix

## 1. Architecture en couches (Backend FastAPI)

Le backend métier de Recouvrix repose exclusivement sur **Python / FastAPI** (`backend/app/`) :

- **`backend/app/core/`** : configuration environnement (`config.py`), moteur SQLAlchemy avec mode WAL et clés étrangères (`database.py`), hachage `scrypt` et jetons HMAC-SHA256 (`security.py`), gestion centralisée des erreurs (`errors.py`) et exécuteur Alembic (`migrations.py`).
- **`backend/app/models/`** : modèles relationnels SQLAlchemy 2.0 cloisonnés par `organization_id` :
  - `Organization` (`organizations`)
  - `User`, `UserSession`, `LoginAttempt` (`users`, `sessions`, `login_attempts`)
  - `Client`, `CommunicationPreference` (`clients`, `communication_preferences`)
  - `Invoice`, `Payment`, `PaymentAllocation`, `PromiseToPay`, `Dispute`, `Reminder`
  - `ImportBatch`, `Document` (`imports`, `documents`)
  - `PaymentSetting`, `AppMeta` (`payment_settings`, `app_meta`)
  - `ActivityLog` (`activity_logs`)
- **`backend/app/schemas/`** : schémas Pydantic v2 de validation stricte des entrées et sorties.
- **`backend/app/auth/`** : authentification serveur, verrouillage anti-force-brute, révocation des sessions et contrôle d'accès par rôle (`ADMIN` / `MANAGER`).
- **`backend/app/services/`** :
  - `financial_calc.py` : calcul déterministe des soldes restants dus, retards, statuts et indicateurs du tableau de bord (les paiements non confirmés ne réduisent jamais le solde dû).
  - `client_service.py` : gestion des fiches clients, détection des doublons, recherche/filtrage/tri/pagination, archivage sans suppression des factures/paiements/historiques, traçabilité des modifications.
  - `audit_service.py` : journalisation horodatée par organisation et par entité.
  - `demo_service.py` : initialisation et réinitialisation centralisées des données de démonstration.
- **`backend/app/ai/`** : intégration serveur `google-genai` (`gemini-4-hydrogen`) pour la synthèse des priorités, avec repli explicite en cas d'indisponibilité.
- **`backend/app/documents/`** : gestion documentaire avec confinement strict des chemins sur disque.
- **`backend/app/api/routers/`** : exposition des routes REST `/api/*`.

Le serveur Node (`server.ts`) sert uniquement de passerelle HTTP (Vite en développement, fichiers statiques `dist/` en production) et délègue toutes les routes `/api/*` au processus FastAPI Uvicorn. Aucune logique métier ni accès base de données ne subsiste côté Node.

---

## 2. Principales routes API (équipe technique)

| Méthode & Route | Rôle | Description |
| --- | --- | --- |
| `GET /api/health` | Public | Vérification de disponibilité FastAPI |
| `GET /api/auth/status` | Public | Indique si l'initialisation admin initiale est requise |
| `POST /api/auth/bootstrap` | Public (unique) | Création initiale des comptes de présentation |
| `POST /api/auth/login` | Public | Authentification par e-mail / mot de passe (Bearer token) |
| `POST /api/auth/logout` | Connecté | Révocation de la session active |
| `GET /api/auth/me` | Connecté | Profil utilisateur courant |
| `GET /api/admin/users` | Admin | Liste des utilisateurs de l'organisation |
| `POST /api/admin/users` | Admin | Création de compte utilisateur |
| `PATCH /api/admin/users/{id}` | Admin | Modification de nom, rôle ou activation |
| `GET /api/dashboard` | Connecté | KPIs, priorités du jour, évolution et répartition |
| `GET /api/clients` | Connecté | Liste paginée, filtrée et triée des clients avec soldes calculés |
| `POST /api/clients` | Connecté | Création d'un client et de ses préférences de communication |
| `GET /api/clients/{id}` | Connecté | Fiche client complète (coordonnées, préférences, finances, suivi) |
| `PATCH /api/clients/{id}` | Connecté | Mise à jour des informations, coordonnées et préférences |
| `POST /api/clients/{id}/archive` | Connecté | Archivage non destructif du dossier client |
| `POST /api/clients/{id}/restore` | Connecté | Restauration d'un dossier client archivé |

---

## 3. Migrations Alembic & Persistance

- En environnement hébergé, configurer `RECOUVRIX_DATABASE_URL` vers une base persistante (PostgreSQL ou volume SQLite monté persistant, par défaut `./data/recouvrix.sqlite` en mode WAL).
- Appliquer les migrations manuellement :
  ```bash
  .venv/bin/alembic -c backend/alembic.ini upgrade head
  ```
- Vérifier la révision courante :
  ```bash
  .venv/bin/alembic -c backend/alembic.ini current
  ```
- Les migrations sont également exécutées automatiquement au démarrage de FastAPI.

---

## 4. Procédure de sauvegarde et restauration

### Créer une sauvegarde à chaud (sans interruption de service)
```bash
.venv/bin/python -m backend.scripts.backup_db backup
```
Un fichier horodaté est généré dans `data/backups/recouvrix-backup-YYYYMMDDTHHMMSSZ.sqlite` et vérifié immédiatement par `PRAGMA integrity_check;`.

### Restaurer une sauvegarde
1. Arrêter le serveur applicatif afin de libérer toute connexion active.
2. Exécuter la restauration (une sauvegarde de sécurité préalable de la base courante est automatiquement réalisée) :
   ```bash
   .venv/bin/python -m backend.scripts.backup_db restore data/backups/recouvrix-backup-YYYYMMDDTHHMMSSZ.sqlite
   ```
3. Exécuter `.venv/bin/alembic -c backend/alembic.ini upgrade head` puis redémarrer le serveur.
