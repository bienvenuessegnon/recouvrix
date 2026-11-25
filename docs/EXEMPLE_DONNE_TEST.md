# Données de test prêtes à l’emploi pour la démo Recouvrix

Pour tester le module **Importation** lors de votre présentation au hackathon BWAI'2026, vous pouvez utiliser le fichier CSV déjà préparé ou copier-coller les informations ci-dessous.

## 1. Fichier CSV prêt à télécharger / uploader
Le fichier est accessible dans l'application à l'emplacement `/public/sample_creances.csv`. Vous pouvez l'enregistrer sur votre bureau pour le glisser-déposer dans l'écran d'importation de Recouvrix.

### Contenu du fichier de test (`sample_creances.csv`) :
```csv
reference;client_name;client_contact;issue_date;due_date;amount;currency
FAC-2026-0501;Entreprise Générale du Bénin SARL;contact@egb-benin.bj;2026-10-15;2026-11-15;1850000;XOF
FAC-2026-0502;Quincaillerie Moderne Cotonou;achat@quincaillerie-moderne.bj;2026-10-20;2026-11-20;3200000;XOF
FAC-2026-0503;Transport et Logistique Atlantique;exploitation@tla-transit.bj;2026-11-01;2026-12-01;2450000;XOF
FAC-2026-0504;Cabinet d'Études KPODEDJI;kpodedi.etudes@gmail.com;2026-11-05;2026-12-05;950000;XOF
FAC-2026-0505;Boulangerie Pâtisserie La Joyeuse;contact@lajoyeuse.bj;2026-11-10;2026-12-10;680000;XOF
```

---

## 2. Scénario de test pour le jury
1. Rendez-vous dans le module **Importation** (`/importation`).
2. Glissez-déposez le fichier `sample_creances.csv`.
3. Observez l'analyse instantanée (étape 2 et 3) avec la correspondance des colonnes.
4. Vérifiez le tableau récapitulatif (étape 4) montrant les 5 nouvelles créances valides, prêtes à être intégrées dans le portefeuille.
5. Cliquez sur **Valider l'analyse et continuer** puis **Enregistrer le lot** pour injecter ces créances en base de données.
6. Retournez sur le **Tableau de bord** pour voir le portefeuille et les nouveaux indicateurs financiers recalculés en temps réel !
