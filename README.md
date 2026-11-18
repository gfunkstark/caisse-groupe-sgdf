# Caisse d'unité — application de saisie des dépenses de camp

Application web (Google Apps Script + Google Sheet) permettant aux chefs d'un
groupe Scouts et Guides de France d'enregistrer les **dépenses et recettes de
camp**, avec photo du justificatif, depuis leur téléphone — sans compte Google.

Un seul lien pour tout le groupe ; un **code à 6 chiffres** par chef ouvre la
caisse de son unité. Sessions de 30 jours, suivi du budget en direct, badge
« justificatif manquant », édition/suppression des lignes.

> Développée pour le groupe **Saint-Lambert de Vaugirard (Paris 15)**. Ce dépôt
> est un **template** : un autre groupe peut cliquer **« Use this template »**,
> obtenir sa propre copie, et l'adapter en changeant sa configuration
> (voir [`CONFIGURATION.md`](CONFIGURATION.md)).

---

## Contenu du dépôt

```
apps-script/
  Code.gs                    ← back-end (obligatoire)
  Index.html                 ← interface, fichier nommé « Index » (obligatoire)
  comptaweb/                 ← intégration comptaweb (OPTIONNELLE)
    CreerPageMouvements.gs      prépare l'onglet Mouvements + menus déroulants
    FiltreDetailTransaction.gs  filtre « Détail transaction » selon le mode
    BackupJustificatifs.gs      archive les justificatifs par n° de pièce
README.md
CONFIGURATION.md             ← ce que chaque groupe doit personnaliser
```

**L'application de base** (saisie + budget) ne nécessite que `Code.gs` et
`Index.html`. Les trois fichiers de `comptaweb/` ne servent qu'aux groupes qui
veulent **pousser automatiquement les écritures dans comptaweb** ; ils vont de
pair avec le robot Python (dépôt séparé `SGDF_Budget`).

---

## Installer l'application (version de base)

1. Créer un Google Sheet (ex. « Caisse d'unités »).
2. **Extensions → Apps Script**.
3. Coller le contenu de `apps-script/Code.gs` dans le fichier `Code.gs`.
4. Créer un fichier HTML nommé **exactement `Index`** et y coller
   `apps-script/Index.html`.
5. Personnaliser le bloc `CONFIG` (voir [`CONFIGURATION.md`](CONFIGURATION.md)).
6. Exécuter une fois `initialiserClasseur` (crée les onglets Mouvements et
   Paramètres).
7. **Déployer → Nouveau déploiement → Application web**, en
   **« Exécuter en tant que : Moi »** et **« Qui a accès : Tout le monde »**.
8. Copier l'URL `/exec` du déploiement et la coller dans `CONFIG.URL_APP`.

> **Mises à jour** : ne jamais créer un *nouveau* déploiement (l'URL
> changerait). Faire **Gérer les déploiements → crayon → Version : Nouvelle
> version → Déployer**. L'URL reste la même.

### Créer les accès des chefs

Dans l'onglet **Paramètres**, une ligne par chef :
`Email | Prénom | Branche/Pôle | Budget camp`. Puis, via le menu
**Caisse d'unité** du Sheet :
- **Générer les codes manquants** → un code à 6 chiffres apparaît.
- **Envoyer l'accès par mail (ligne sélectionnée)** → le chef reçoit code + lien.

### Côté chef

Ouvrir le lien dans **Safari (iPhone)** ou **Chrome (Android)**, puis
**Partager / menu → « Sur l'écran d'accueil »** pour l'installer comme une appli.

---

## Intégration comptaweb (optionnelle)

Pour pousser automatiquement les dépenses dans comptaweb :

1. Ajouter les trois fichiers de `apps-script/comptaweb/` au projet Apps Script.
2. Le menu **Caisse d'unité** gagne « Préparer l'onglet Mouvements » et
   « Sauvegarder les justificatifs ».
3. Mettre en place le **robot Python** (dépôt `SGDF_Budget` :
   `refresh_metadata.py` + `ecrire_comptaweb.py`, via GitHub Actions) qui lit les
   lignes complétées et crée les écritures dans comptaweb.

Le détail du circuit complet (mapping, n° de pièce, back-up) est documenté dans
le dépôt du robot.

---

## Maintenance de ce dépôt

Ce dépôt est la **source de vérité** du code. Toute modification y est commitée
d'abord ; on recopie ensuite dans l'éditeur Apps Script pour redéployer. Les deux
ne divergent donc jamais.
