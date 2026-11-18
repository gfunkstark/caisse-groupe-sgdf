/**
 * ═══════════════════════════════════════════════════════════════════════
 *  PRÉPARER L'ONGLET MOUVEMENTS — menus déroulants dynamiques (option A)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Crée/complète l'onglet "Mouvements" (colonnes caisse + colonnes comptaweb)
 *  et pose les listes déroulantes :
 *
 *   • Nature / Branche-Pôle  → valeurs de la webapp (CONFIG)
 *   • Nature compta          → pointe vers Métadonnées!A (colonne Nature)
 *   • Activité               → pointe vers Métadonnées!C (colonne Activité)
 *   • Branche compta         → pointe vers Métadonnées!E (colonne Branche)
 *   • Détail transaction     → pointe vers Métadonnées!I (colonne Détail)
 *
 *  Les 4 menus comptaweb pointent vers les COLONNES de l'onglet Métadonnées,
 *  pas vers des valeurs figées. Résultat : quand le script Python rafraîchit
 *  Métadonnées (chaque lundi ou à la demande), les menus suivent tout seuls,
 *  SANS relancer aucun Apps Script. C'est l'option A.
 *
 *  À lancer : menu « Caisse d'unité → Préparer l'onglet Mouvements »
 *  (ou exécuter creerPageMouvements depuis l'éditeur).
 *  À NE relancer que si tu ajoutes/déplaces des colonnes — pas à chaque refresh.
 *
 *  Prérequis : l'onglet "Métadonnées" doit exister (créé par refresh_metadata.py).
 *  Dépend de CONFIG (caisse) et de classeur_(). Même projet Apps Script.
 * ═══════════════════════════════════════════════════════════════════════
 */

// Nom de l'onglet des métadonnées (doit correspondre à METADATA_SHEET du script Python)
var ONGLET_METADONNEES = 'Métadonnées';

// Colonnes (lettre) de Métadonnées où se trouvent les LIBELLÉS à proposer
var META_COL = {
  nature:   'A',   // Nature
  activite: 'C',   // Activité
  branche:  'E',   // Branche
  detail:   'I'    // Détail
};

// Colonnes comptaweb ajoutées après les colonnes de la caisse (CONFIG.COLONNES)
var COLONNES_COMPTA = [
  'Nature compta',
  'Activité',
  'Branche compta',
  'Détail transaction',
  'N° chèque',
  'N° de pièce',
  'Comptabilisé le'
];


// ─────────────────────────────────────────────────────────────
//  CONSTRUCTION
// ─────────────────────────────────────────────────────────────

function creerPageMouvements() {
  var ui = SpreadsheetApp.getUi();
  var ss = classeur_();

  // L'onglet Métadonnées doit exister (peuplé par le script Python)
  var meta = ss.getSheetByName(ONGLET_METADONNEES);
  if (!meta) {
    ui.alert('Onglet « ' + ONGLET_METADONNEES + ' » introuvable',
      'Lance d\'abord le script Python « refresh_metadata » pour créer et ' +
      'remplir l\'onglet Métadonnées, puis relance cette fonction.',
      ui.ButtonSet.OK);
    return;
  }

  var nom = CONFIG.ONGLET_MOUVEMENTS;
  var feuille = ss.getSheetByName(nom);
  var creation = false;
  if (!feuille) {
    feuille = ss.insertSheet(nom);
    creation = true;
  } else if (feuille.getLastRow() > 1) {
    var rep = ui.alert('Onglet « ' + nom + ' » déjà rempli',
      'Le script va seulement AJOUTER les en-têtes manquants et poser les ' +
      'listes déroulantes, sans toucher aux lignes existantes.\n\nContinuer ?',
      ui.ButtonSet.OK_CANCEL);
    if (rep !== ui.Button.OK) return;
  }

  // En-têtes complets = colonnes caisse + colonnes comptaweb
  var enTetesVoulus = CONFIG.COLONNES.concat(COLONNES_COMPTA);

  var enTetesActuels = feuille.getLastColumn() > 0
    ? feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0].map(function (v) { return String(v).trim(); })
    : [];

  var colIndex = {};
  enTetesVoulus.forEach(function (titre) {
    var pos = enTetesActuels.indexOf(titre);
    if (pos === -1) {
      var nouvelle = Math.max(feuille.getLastColumn(), enTetesActuels.length) + 1;
      feuille.getRange(1, nouvelle).setValue(titre);
      enTetesActuels[nouvelle - 1] = titre;
      colIndex[titre] = nouvelle;
    } else {
      colIndex[titre] = pos + 1;
    }
  });

  feuille.getRange(1, 1, 1, enTetesActuels.length).setFontWeight('bold');
  feuille.setFrozenRows(1);

  var nbLignes = Math.max(feuille.getMaxRows() - 1, 1);

  // ── Menus de la webapp (valeurs figées depuis CONFIG) ──
  var naturesApp = (CONFIG.NATURES || []).concat(CONFIG.NATURES_RECETTE || []);
  naturesApp = naturesApp.filter(function (v, i) { return naturesApp.indexOf(v) === i; });
  var branchesApp = Object.keys(CONFIG.COULEURS_BRANCHE || {});
  branchesApp = branchesApp.filter(function (v, i) { return branchesApp.indexOf(v) === i; }).sort();

  // Mode de paiement (webapp) : dépenses + recettes, dédupliqués
  var modesApp = (CONFIG.MODES_PAIEMENT || []).concat(CONFIG.MODES_RECETTE || []);
  modesApp = modesApp.filter(function (v, i) { return modesApp.indexOf(v) === i; });
  if (colIndex['Mode de paiement']) listeDepuisValeurs_(feuille, colIndex['Mode de paiement'], modesApp, nbLignes);

  if (colIndex['Nature'])        listeDepuisValeurs_(feuille, colIndex['Nature'], naturesApp, nbLignes);
  if (colIndex['Branche/Pôle'])  listeDepuisValeurs_(feuille, colIndex['Branche/Pôle'], branchesApp, nbLignes);

  // ── Menus comptaweb (DYNAMIQUES : pointent vers les colonnes de Métadonnées) ──
  if (colIndex['Nature compta'])      listeDepuisMeta_(feuille, colIndex['Nature compta'],      META_COL.nature,   meta, nbLignes);
  if (colIndex['Activité'])           listeDepuisMeta_(feuille, colIndex['Activité'],           META_COL.activite, meta, nbLignes);
  if (colIndex['Branche compta'])     listeDepuisMeta_(feuille, colIndex['Branche compta'],     META_COL.branche,  meta, nbLignes);
  if (colIndex['Détail transaction']) listeDepuisMeta_(feuille, colIndex['Détail transaction'], META_COL.detail,   meta, nbLignes);

  // ── Colonnes en format texte ──
  ['N° chèque', 'N° de pièce'].forEach(function (c) {
    if (colIndex[c]) feuille.getRange(2, colIndex[c], nbLignes, 1).setNumberFormat('@');
  });

  // ── Largeurs confortables ──
  [['Nature compta', 240], ['Activité', 220], ['Branche compta', 220],
   ['Détail transaction', 260], ['N° chèque', 110], ['N° de pièce', 130],
   ['Comptabilisé le', 150]].forEach(function (p) {
    if (colIndex[p[0]]) feuille.setColumnWidth(colIndex[p[0]], p[1]);
  });

  SpreadsheetApp.flush();

  ui.alert(creation ? 'Onglet Mouvements créé' : 'Onglet Mouvements mis à jour',
    'Menus en place :\n\n' +
    '• Nature / Branche-Pôle → valeurs de la webapp\n' +
    '• Nature compta, Activité, Branche compta, Détail transaction → ' +
    'pointent vers l\'onglet Métadonnées (mise à jour automatique à chaque refresh)\n' +
    '• N° chèque → à la main si chèque\n' +
    '• N° de pièce, Comptabilisé le → remplies par le robot\n\n' +
    'Tu n\'auras pas à relancer cette fonction après un refresh : les menus ' +
    'comptaweb suivent l\'onglet Métadonnées automatiquement.',
    ui.ButtonSet.OK);
}


// ─────────────────────────────────────────────────────────────
//  OUTILS DE VALIDATION
// ─────────────────────────────────────────────────────────────

/** Menu déroulant à partir d'une liste de valeurs figées. */
function listeDepuisValeurs_(feuille, colonne1based, valeurs, nbLignes) {
  if (!valeurs || !valeurs.length) return;
  var regle = SpreadsheetApp.newDataValidation()
    .requireValueInList(valeurs, true)
    .setAllowInvalid(false)
    .setHelpText('Choisis une valeur dans la liste.')
    .build();
  feuille.getRange(2, colonne1based, nbLignes, 1).setDataValidation(regle);
}

/**
 * Menu déroulant DYNAMIQUE : pointe vers une colonne de l'onglet Métadonnées.
 * La plage source va de la ligne 2 à la dernière ligne remplie de cette colonne.
 * Quand le script Python réécrit Métadonnées, le menu reflète les nouvelles valeurs.
 */
function listeDepuisMeta_(feuille, colonne1based, lettreColMeta, meta, nbLignes) {
  // Dernière ligne remplie de la colonne source dans Métadonnées
  var colNum = lettreColMeta.charCodeAt(0) - 64; // 'A' -> 1
  var valeurs = meta.getRange(2, colNum, Math.max(meta.getLastRow() - 1, 1), 1).getValues();
  var derniere = 1;
  for (var i = 0; i < valeurs.length; i++) {
    if (String(valeurs[i][0]).trim() !== '') derniere = i + 2; // +2 : on part de la ligne 2
  }

  var source = meta.getRange(lettreColMeta + '2:' + lettreColMeta + derniere);

  var regle = SpreadsheetApp.newDataValidation()
    .requireValueInRange(source, true)   // true = menu déroulant visible
    .setAllowInvalid(false)
    .setHelpText('Valeur issue de l\'onglet Métadonnées (comptaweb).')
    .build();

  feuille.getRange(2, colonne1based, nbLignes, 1).setDataValidation(regle);
}