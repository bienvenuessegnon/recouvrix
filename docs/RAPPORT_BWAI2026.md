# Rapport Recouvrix — Hackathon BWAI’2026

**Cas pratique 1** — Recouvrement automatique des factures impayées  
**Prototype** : Recouvrix (React + Express + SQLite démo)  
**Référence TDR** : BWAI Benin Workshop on Artificial Intelligence 2026  
**Version code** : commit figé au moment de la remise (empreinte GitHub / Origin)

---

## 1. Besoin

Les PME béninoises suivent souvent leurs créances sur Excel, papier ou WhatsApp. Conséquences observées :

- relances tardives ou oubliées ;
- factures déjà réglées encore sollicitées ;
- litiges non pris en compte ;
- faible visibilité sur encours et trésorerie.

Le besoin n’est pas d’automatiser les décisions sensibles, mais d’**organiser le travail humain** : prioriser, préparer, valider, tracer.

Recouvrix répond au **cas 1** du TDR : portefeuille unifié, calculs déterministes, relances simulées (Email / WhatsApp), validation humaine obligatoire, Mobile Money fictif signalé comme tel.

---

## 2. Parcours démontré

Parcours principal (réexécutable) :

1. **Connexion** — création de compte (SQLite) ou comptes démo via secrets serveur.
2. **Importation** — CSV / Excel / PDF ; contrôle des champs et doublons ; validation du lot.
3. **Tableau de bord** — encours, retards, actions prioritaires du jour, file à revoir.
4. **Fiche facture** — timeline, litiges, promesses, avoirs, pièces.
5. **Relance** — brouillon assisté (Gemini si clé présente, sinon repli déterministe), relecture, validation, envoi simulé.
6. **Paiement** — déclaration / justificatif simulé → confirmation → quittance PDF.

**Exceptions couvertes** : litige (suspension), gros montant au-delà d’un seuil (revue humaine), promesse échue, paiement partiel, doublon d’import, annulation d’une relance devenue injustifiée.

**Reprise** : données métier en mémoire réinitialisables ; comptes / sessions en SQLite locale (`data/`) pour tenir après redémarrage du processus.

---

## 3. Architecture

| Couche | Choix | Rôle |
|---|---|---|
| UI | React 19, TypeScript, Tailwind, design system Recouvrix | Parcours métier lisible (desktop / mobile) |
| API | Express monolithique (`server.ts`) | Auth, calculs, imports, relances, PDF |
| Persistance démo | Mémoire + SQLite (`demoStore.ts`) | Métier en mémoire ; users/sessions persistés |
| IA | `@google/genai` (Gemini) optionnel | Priorités / brouillons — jamais les soldes |
| Déploiement | Render (Node / Docker) | Prototype public de démonstration |

Séparation volontaire : **l’IA suggère**, le **moteur calcule**, l’**humain valide**.

---

## 4. Contrôles métier et sécurité

**Calculs déterministes** : soldes = facture − paiements confirmés − avoirs validés ; retards à partir d’une date de référence ; statuts dérivés (non échue, échue, partielle, soldée, contestée, promesse).

**Priorisation** (heuristique documentée, non prédictive) : litiges et promesses échues d’abord, puis ancienneté × solde, puis historique de retard. Objectif : classer le travail, pas prédire le défaut.

**Maîtrise des actions** :

- validation humaine avant envoi simulé ;
- seuil de montant configurable ;
- révérification solde / statut / préférences juste avant envoi ;
- clés d’idempotence sur litiges, promesses, avoirs, paiements ;
- rôles Admin / Gestionnaire ; sessions Bearer à TTL ; mots de passe scrypt ;
- aucun secret dans le code source (mots de passe démo uniquement via variables d’environnement).

---

## 5. Protocole et résultats de tests

**Protocole de référence (Excel)** — même portefeuille fictif de 5 créances :

| Étape | Excel (réf.) | Recouvrix |
|---|---|---|
| Import + contrôle doublons | ~8–12 min | ~1–2 min |
| Identifier 3 priorités | ~5–8 min | immédiat (liste) |
| Rédiger 1 relance personnalisée | ~4–6 min | ~1 min (brouillon + relecture) |
| Erreurs typiques évitées | doubles relances, litige oublié | bloquées / signalées |

**Mesures observées sur le prototype** (scénario jury documenté dans `docs/EXEMPLE_DONNE_TEST.md`) :

- détection du doublon `FAC-2026-0418` à l’import ;
- relance suspendue sur dossier contesté ;
- solde partiel après paiement simulé 850 000 XOF ;
- journal d’activité horodaté pour chaque validation.

Les gains de temps ci-dessus sont des **estimations de démonstration** face à Excel, pas une étude terrain. Ils distinguent clairement le temps humain de préparation de l’exactitude des calculs (indépendante de l’IA).

---

## 6. Comparaison à la référence Excel

| Critère | Excel | Recouvrix |
|---|---|---|
| Exactitude soldes | dépend de la saisie | moteur unique partagé UI/API |
| Priorisation | manuelle, variable | heuristique stable et expliquée |
| Relance | copier-coller | message lié à la facture + validation |
| Audit | faible | journal + timeline facture |
| IA | absente | assistive, séparée des calculs |

---

## 7. Limites

- Prototype de démonstration : portefeuille métier surtout en mémoire (éphémère au redémarrage sauf seed).
- Canaux Email / WhatsApp / Mobile Money **simulés** uniquement.
- Mode offline « faible connectivité » : SQLite pour auth + reprise locale du process ; pas encore de file offline multi-appareils.
- Qualité IA dépend de `GEMINI_API_KEY` ; sans clé, repli heuristique / modèles de texte.
- Pas de conformité comptable certifiée ni d’intégration bancaire réelle.

---

## 8. Coûts estimatifs d’usage

| Poste | Ordre de grandeur (démo) |
|---|---|
| Hébergement Render free / starter | 0–7 USD / mois |
| Gemini (brouillons + priorités) | quelques centimes à 2–5 USD / mois selon volume |
| Domaine / TLS | inclus plateforme ou ~10 USD / an |

À l’échelle PME (1–3 gestionnaires, ~200 factures / mois), le coût variable dominant est l’API IA, maîtrisé en limitant les appels et en gardant le repli local.

---

## 9. Suite après l’événement

1. Persistance Postgres pour le portefeuille métier.  
2. File de reprise offline synchronisable.  
3. Intégration SMS / WhatsApp Business (toujours avec validation humaine).  
4. Expérimentation terrain avec 2–3 PME + protocole de mesure 4 semaines.  
5. Tests automatisés élargis (soldes, idempotence, seuils).

---

*Document remis au jury BWAI’2026 — ~4 pages.*
