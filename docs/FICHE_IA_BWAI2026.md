# Fiche IA — Recouvrix (BWAI’2026)

Résultats **métier** et résultats **IA** sont présentés séparément, conformément au TDR.

---

## 1. Modèle et version

| Élément | Valeur |
|---|---|
| Fournisseur | Google GenAI (`@google/genai`) |
| Modèle appelé | `gemini-4-hydrogen` (quand `GEMINI_API_KEY` est définie) |
| Repli | Heuristiques / modèles de texte déterministes sans appel réseau |
| Rôle | Assistant uniquement — **jamais** source de vérité des montants |

---

## 2. Tâches IA

1. **Priorisation assistée (dashboard)** — reformuler / ordonner des suggestions à partir de signaux déjà calculés (retard, solde, litige, promesse).  
2. **Brouillon de relance** — rédiger un message courtois (Email / WhatsApp simulé) à partir de référence, échéance, solde et canal préféré.

Hors périmètre IA : calcul des soldes, retards, doublons, idempotence, statuts comptables.

---

## 3. Données et séparation des jeux

| Jeu | Contenu | Usage |
|---|---|---|
| Démo seed | Portefeuille fictif PME béninoises (clients, factures, paiements, litiges) | Démonstration jury |
| Import test | `sample_creances.csv` / `sample_portefeuille_entree.pdf` | Scénario d’entrée |
| Production | non applicable (prototype) | — |

Aucune donnée personnelle réelle n’est utilisée. Les paiements Mobile Money / virements sont **fictifs et signalés**.

---

## 4. Méthode d’évaluation

| Dimension | Méthode | Critère de succès |
|---|---|---|
| Métier (hors IA) | Scénarios manuels + contrôles API | Soldes / statuts exacts vs Excel de référence |
| IA — priorités | Comparaison à la liste heuristique déterministe | Pas de dossier litige oublié en tête de file |
| IA — brouillon | Relecture humaine obligatoire | Référence, échéance et solde présents et corrects |
| Incertitude | Seuil montant + litige + cas douteux | Blocage jusqu’à validation humaine |

---

## 5. Erreurs observées (IA)

- Sans clé API : pas d’appel modèle — repli local (comportement attendu).  
- Avec clé : ton parfois trop marketing → corrigé à la relecture.  
- Risque d’omettre une contrainte métier si le prompt est incomplet → **mitigé** en injectant solde/échéance/référence côté serveur avant génération, et en réaffichant ces champs dans l’UI de validation.

Aucune erreur de solde attribuée à l’IA : les montants affichés viennent du moteur déterministe.

---

## 6. Seuils de revue humaine

| Condition | Action |
|---|---|
| Tout envoi de relance | Validation humaine obligatoire |
| Montant ≥ seuil org. (ex. 2 000 000 XOF) | File « à revoir » avant suite |
| Litige ouvert | Relance bloquée / suspendue |
| Solde devenu nul ou statut changé avant envoi | Annulation de la relance |
| Confiance rédactionnelle faible / texte incohérent | Édition manuelle du brouillon |

---

## 7. Limites

- Pas de prédiction de non-paiement (interdit par le TDR pour le socle).  
- Qualité dépendante du fournisseur et du quota.  
- Canaux d’envoi simulés uniquement.  
- Évaluation IA qualitative sur jeu fictif, non statistique terrain.

---

## 8. Synthèse séparée

**Métier** : exactitude des soldes, prévention des doublons, traçabilité — indépendants de l’IA.  
**IA** : accélération de la rédaction et de la lecture des priorités — toujours sous contrôle humain.
