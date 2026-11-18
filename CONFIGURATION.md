# Configuration — ce que chaque groupe doit personnaliser

Après avoir cliqué **« Use this template »**, un groupe adapte l'application à sa
situation en changeant **uniquement** les éléments ci-dessous. Le reste du code
n'a pas à être touché.

---

## 1. Le bloc `CONFIG` dans `apps-script/Code.gs`

En haut de `Code.gs`, l'objet `CONFIG` centralise tout le paramétrage de la
caisse.

| Clé | À adapter | Remarque |
|---|---|---|
| `URL_APP` | **Oui** | L'URL `/exec` de **votre** déploiement (voir étape 8 du README). Laisser vide tant qu'elle n'existe pas. |
| `COULEURS_BRANCHE` | **Oui** | Les branches/pôles de votre groupe et leur couleur. **Ces libellés doivent correspondre au caractère près** à la colonne « Branche/Pôle » de l'onglet Paramètres. |
| `NATURES` | Éventuellement | Catégories de dépense proposées. |
| `NATURES_RECETTE` | Éventuellement | Catégories de recette. |
| `MODES_PAIEMENT` | Éventuellement | Modes de paiement (dépenses). |
| `MODES_RECETTE` | Éventuellement | Modes d'encaissement (recettes). |
| `DUREE_SESSION_JOURS` | Rarement | Durée de session sur l'appareil (défaut 30). |
| `HISTORIQUE` | Rarement | Nombre de lignes affichées dans l'historique (défaut 8). |

Les autres clés (`ONGLET_*`, `COLONNES`, sécurité anti-brute-force…) peuvent
rester telles quelles.

---

## 2. Le logo dans `apps-script/Index.html`

Par défaut, le template **n'affiche aucun logo**. Pour ajouter celui de votre
groupe (une image carrée, idéalement hébergée sur un site stable, pas Google
Drive), trois endroits sont prévus (balises commentées à décommenter) :

- En haut du fichier : les deux `<link rel="icon">` / `<link rel="apple-touch-icon">`
  (icône sur l'écran d'accueil) — remplacez `URL_DU_LOGO`.
- Dans l'en-tête (`<div class="marque">`) : la balise `<img class="logo">`.
- Dans la fonction `demanderCode()` : vous pouvez rajouter une `<img>` au-dessus
  du titre, sur l'écran de saisie du code.

Sans logo, l'application reste parfaitement fonctionnelle.

---

## 3. L'intégration comptaweb (si utilisée)

Dans `apps-script/comptaweb/BackupJustificatifs.gs` :

| Variable | À adapter |
|---|---|
| `BACKUP_FOLDER_ID` | L'ID de **votre** dossier Drive de back-up des justificatifs. |

Les fichiers `CreerPageMouvements.gs` et `FiltreDetailTransaction.gs` lisent la
configuration depuis l'onglet **Métadonnées** (rempli par le robot Python) et
depuis `CONFIG` — ils n'ont normalement rien d'autre à changer, **sauf** la table
`MODE_CAISSE_VERS_COMPTA` (dans `FiltreDetailTransaction.gs`) si vos modes de
paiement diffèrent de ceux de ce template.

> L'intégration comptaweb suppose aussi le robot Python du dépôt `SGDF_Budget`
> (secrets GitHub, compte de service Google). Voir ce dépôt.

---

## Récapitulatif minimal (version de base, sans comptaweb)

Pour une caisse simple (saisie + budget), il suffit de changer :

1. `CONFIG.COULEURS_BRANCHE` (vos branches),
2. `CONFIG.URL_APP` (après déploiement).

Le logo (`Index.html`) est optionnel — désactivé par défaut.

Tout le reste fonctionne tel quel.
