# Manuel du trésorier — Caisse d'unité

Guide complet de déploiement et d'utilisation de l'application, destiné au
**trésorier de groupe**. Pour la configuration à personnaliser, voir
[`../CONFIGURATION.md`](../CONFIGURATION.md). Pour le guide destiné aux chefs,
voir [`guide-des-chefs.html`](guide-des-chefs.html).

---

## 1. Ce que fait l'application

Les chefs enregistrent les **dépenses et recettes de camp** avec la photo du
justificatif, depuis leur téléphone. Chaque chef a un **code à 6 chiffres** qui
ouvre la caisse de son unité. L'application suit le **budget en direct**, signale
les **justificatifs manquants**, et permet de corriger ou supprimer une ligne.

Deux niveaux :
- **Base** : saisie + suivi de budget (fichiers `Code.gs` + `Index.html`).
- **Option comptaweb** : écriture automatique des dépenses dans comptaweb
  (fichiers de `apps-script/comptaweb/` + robot Python du dépôt `SGDF_Budget`).

---

## 2. Déployer l'application

1. Créer un **Google Sheet** (ex. « Caisse d'unités »), de préférence dans le
   Drive du compte trésorerie du groupe.
2. **Extensions → Apps Script**.
3. Coller `apps-script/Code.gs` dans le fichier `Code.gs`.
4. Créer un fichier HTML nommé **exactement `Index`** et y coller
   `apps-script/Index.html`.
5. Personnaliser le bloc `CONFIG` (branches, couleurs, natures…) — voir
   `CONFIGURATION.md`.
6. Exécuter une fois **`initialiserClasseur`** depuis l'éditeur : il crée les
   onglets **Mouvements** et **Paramètres** avec leurs en-têtes.
7. **Déployer → Nouveau déploiement → Application web** :
   - *Exécuter en tant que* : **Moi**
   - *Qui a accès* : **Tout le monde**
   - Autoriser le script (passer l'écran « application non vérifiée »).
8. Copier l'**URL `/exec`** et la coller dans `CONFIG.URL_APP`, puis enregistrer.

> ⚠️ **Mises à jour** : ne jamais créer un *nouveau* déploiement (l'URL
> changerait et les chefs perdraient l'accès). Faire **Gérer les déploiements →
> crayon → Version : Nouvelle version → Déployer**. L'URL reste identique.

L'autorisation d'envoi de mail (pour « Code oublié ? » et « Envoyer l'accès »)
est demandée à la première exécution de ces fonctions.

---

## 3. Créer les accès des chefs

Dans l'onglet **Paramètres**, une ligne par chef :

| Email | Prénom | Branche/Pôle | Budget camp |
|---|---|---|---|

- La **Branche/Pôle** doit correspondre au caractère près à une clé de
  `CONFIG.COULEURS_BRANCHE`.
- **Budget camp** vide → pas de jauge, juste un cumul des dépenses.
- Un chef sur deux unités → **deux lignes** (même email, branche différente,
  deux codes).

Puis, via le menu **Caisse d'unité** du Sheet :

1. **Générer les codes manquants** → un code à 6 chiffres apparaît en colonne E.
2. Sélectionner la ligne du chef → **Envoyer l'accès par mail** → il reçoit son
   code + le lien (une colonne « Envoyé le » trace l'envoi).

Autres entrées du menu : renouveler un code, débloquer le renvoi de code,
purger / fermer les sessions.

---

## 4. Côté chef (au quotidien)

Le chef ouvre le lien dans **Safari (iPhone)** ou **Chrome (Android)**, l'ajoute
à son écran d'accueil, saisit son code (valable 30 jours), puis enregistre ses
dépenses et recettes avec photo. Voir [`guide-des-chefs.html`](guide-des-chefs.html).

Un **badge orange « justificatif manquant »** et un bandeau compteur signalent
les dépenses sans pièce — utile quand le trésorier ajoute une ligne vue en
banque et demande au chef de compléter la photo.

---

## 5. Intégration comptaweb (optionnelle)

Pour pousser automatiquement les dépenses dans **comptaweb** :

1. Ajouter au projet Apps Script les trois fichiers de `apps-script/comptaweb/`.
   Le menu gagne **« Préparer l'onglet Mouvements »** et
   **« Sauvegarder les justificatifs »**.
2. Mettre en place le **robot Python** (dépôt `SGDF_Budget`) :
   - `refresh_metadata.py` — rafraîchit l'onglet **Métadonnées** depuis le
     formulaire comptaweb (GitHub Actions, hebdomadaire).
   - `ecrire_comptaweb.py` — lit les lignes complétées (mapping Nature compta /
     Activité / Branche compta / Détail transaction) et crée les écritures
     (GitHub Actions, 2×/jour ; garde-fou `DRY_RUN`).
3. Le back-up des justificatifs (`BackupJustificatifs.gs`) tourne côté Apps
   Script (déclencheur journalier), car un compte de service Google n'a pas de
   quota Drive.

Le circuit complet (mapping, numéro de pièce `AAAAMMJJ_X` anti-doublon, back-up
par n° de pièce) est documenté dans le dépôt du robot.

---

## 6. Dépannage rapide

| Symptôme | Cause probable / solution |
|---|---|
| L'appli ne s'ouvre pas, erreur Google Drive | Déploiement pas sur « Tout le monde », mauvaise `URL_APP`, ou pas redéployé en nouvelle version |
| Chef : « connexion sécurisée impossible » (iOS) | Relais privé iCloud actif, ou raccourci en mode « app web » ; ouvrir en Safari normal |
| Le menu « Caisse d'unité » n'apparaît pas | Recharger le Sheet (`onOpen` se rejoue à l'ouverture) |
| Un chef ne reçoit pas son code par mail | Vérifier ses spams ; « Débloquer le renvoi de code » si plafond atteint |
| Couleur / branche qui ne s'affiche pas | Le libellé Branche/Pôle ne correspond pas exactement à une clé de `COULEURS_BRANCHE` |

---

## 7. Maintenance

Ce dépôt GitHub est la **source de vérité** du code. Toute modification est
commitée ici d'abord, puis recopiée dans l'éditeur Apps Script pour redéploiement
(nouvelle version du même déploiement). Le code déployé et le dépôt ne divergent
donc jamais.
