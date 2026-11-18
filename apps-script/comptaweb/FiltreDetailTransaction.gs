/**
 * ═══════════════════════════════════════════════════════════════════════
 *  FILTRE DYNAMIQUE : Mode de paiement → Détail transaction
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Quand tu choisis un « Mode de paiement » (colonne de la caisse) sur une
 *  ligne de l'onglet Mouvements, ce déclencheur repose instantanément la
 *  liste déroulante de « Détail transaction » sur le sous-ensemble pertinent,
 *  lu depuis l'onglet Métadonnées (colonnes Détail / modeDétail).
 *
 *  Exemple : tu choisis « Carte du groupe » → la cellule Détail transaction
 *  ne propose plus que les cartes ; « Espèces » → que les caisses ; etc.
 *
 *  ── Pourquoi c'est sans maintenance ──
 *  Les détails proposés viennent de Métadonnées (rafraîchi par le script
 *  Python). Une nouvelle carte ajoutée par comptaweb apparaît donc toute
 *  seule dans le bon filtre au prochain refresh, sans toucher à ce code.
 *  Seule la table MODE_CAISSE_VERS_COMPTA ci-dessous est en dur — mais tes
 *  modes de caisse ne changent jamais.
 *
 *  ── Installation ──
 *  1. Colle ce fichier dans le projet Apps Script de la caisse.
 *  2. Si tu as DÉJÀ une fonction onEdit ailleurs, ne crée pas de doublon :
 *     renomme celle-ci (voir note en bas) et appelle-la depuis ton onEdit.
 *     Sinon, laisse : Google appelle onEdit(e) automatiquement à chaque
 *     modification de cellule (déclencheur simple, aucune autorisation requise).
 * ═══════════════════════════════════════════════════════════════════════
 */

var ONGLET_METADONNEES = 'Métadonnées';

// Colonnes de Métadonnées (lettres) : Détail et son code de mode
var META_DETAIL_COL = 'I';   // libellés des détails
var META_MODEDET_COL = 'K';  // code du mode comptaweb associé (3=carte, 4=caisse, 2=chèque, 1=virement, 9=procurement)

// Libellés EXACTS des colonnes concernées dans l'onglet Mouvements
var COL_MODE_PAIEMENT   = 'Mode de paiement';
var COL_DETAIL_TRANSAC  = 'Détail transaction';

/**
 * Table : ton mode de caisse → quels modes comptaweb accepter.
 * Un mode de caisse peut correspondre à plusieurs modes comptaweb.
 * Le "filtreLibelle" (optionnel) restreint encore par le texte du détail
 * (utilisé pour isoler SumUp des autres caisses).
 */
var MODE_CAISSE_VERS_COMPTA = {
  'Carte du groupe':    { modes: ['3', '9'] },                  // cartes bancaires + procurement
  'Espèces':            { modes: ['4'], exclutLibelle: 'SumUp' },// caisses, sauf SumUp
  'SumUp':              { modes: ['4'], inclutLibelle: 'SumUp' },// uniquement la caisse SumUp
  'Chèque':             { modes: ['2'] },                        // chéquier
  'Virement':           { modes: ['1'] },                        // compte bancaire
  'Avance personnelle': { modes: ['1'] }                         // remboursé par virement
};


// ─────────────────────────────────────────────────────────────
//  DÉCLENCHEUR
// ─────────────────────────────────────────────────────────────
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var feuille = e.range.getSheet();
    if (feuille.getName() !== CONFIG.ONGLET_MOUVEMENTS) return;
    if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

    var cols = indexColonnesMouvements_(feuille);
    if (!cols[COL_MODE_PAIEMENT] || !cols[COL_DETAIL_TRANSAC]) return;

    // On n'agit que si la cellule modifiée est un "Mode de paiement"
    if (e.range.getColumn() !== cols[COL_MODE_PAIEMENT]) return;

    var ligne = e.range.getRow();
    if (ligne < 2) return;

    var mode = String(e.value || '').trim();
    var celluleDetail = feuille.getRange(ligne, cols[COL_DETAIL_TRANSAC]);

    // Mode vidé → on remet la liste complète des détails
    if (!mode) {
      poserValidationDetail_(celluleDetail, tousLesDetails_());
      return;
    }

    var regle = MODE_CAISSE_VERS_COMPTA[mode];
    if (!regle) {
      // Mode non mappé → liste complète (sécurité)
      poserValidationDetail_(celluleDetail, tousLesDetails_());
      return;
    }

    var details = detailsPourModes_(regle);
    poserValidationDetail_(celluleDetail, details);

    // Si le détail déjà saisi n'est plus compatible, on le vide
    var detailActuel = String(celluleDetail.getValue() || '').trim();
    if (detailActuel && details.indexOf(detailActuel) === -1) {
      celluleDetail.clearContent();
    }
  } catch (err) {
    // Déclencheur simple : on n'interrompt jamais la saisie de l'utilisateur
    // (pas de ui.alert ici, ça bloquerait).
  }
}


// ─────────────────────────────────────────────────────────────
//  LECTURE DE MÉTADONNÉES
// ─────────────────────────────────────────────────────────────

/** Tous les détails (libellés) de Métadonnées, dans l'ordre. */
function tousLesDetails_() {
  var meta = classeur_().getSheetByName(ONGLET_METADONNEES);
  if (!meta) return [];
  var n = Math.max(meta.getLastRow() - 1, 0);
  if (!n) return [];
  var libs = meta.getRange(META_DETAIL_COL + '2:' + META_DETAIL_COL + (n + 1)).getValues();
  var out = [];
  libs.forEach(function (r) {
    var v = String(r[0]).trim();
    if (v) out.push(v);
  });
  return out;
}

/** Détails dont le code de mode ∈ regle.modes, avec filtre libellé éventuel. */
function detailsPourModes_(regle) {
  var meta = classeur_().getSheetByName(ONGLET_METADONNEES);
  if (!meta) return [];
  var n = Math.max(meta.getLastRow() - 1, 0);
  if (!n) return [];

  var colDetail = META_DETAIL_COL.charCodeAt(0) - 64;
  var colMode   = META_MODEDET_COL.charCodeAt(0) - 64;
  var larg = Math.max(colDetail, colMode);
  var bloc = meta.getRange(2, 1, n, larg).getValues();

  var modesOK = regle.modes || [];
  var out = [];
  bloc.forEach(function (row) {
    var lib  = String(row[colDetail - 1]).trim();
    var mode = String(row[colMode - 1]).trim();
    if (!lib) return;
    if (modesOK.indexOf(mode) === -1) return;
    if (regle.inclutLibelle && lib.indexOf(regle.inclutLibelle) === -1) return;
    if (regle.exclutLibelle && lib.indexOf(regle.exclutLibelle) !== -1) return;
    out.push(lib);
  });
  return out;
}


// ─────────────────────────────────────────────────────────────
//  VALIDATION
// ─────────────────────────────────────────────────────────────
function poserValidationDetail_(cellule, valeurs) {
  if (!valeurs || !valeurs.length) {
    cellule.clearDataValidations();
    return;
  }
  var regle = SpreadsheetApp.newDataValidation()
    .requireValueInList(valeurs, true)
    .setAllowInvalid(false)
    .setHelpText('Détail filtré selon le mode de paiement choisi.')
    .build();
  cellule.setDataValidation(regle);
}


// ─────────────────────────────────────────────────────────────
//  UTILITAIRE : index des colonnes de Mouvements par en-tête
// ─────────────────────────────────────────────────────────────
function indexColonnesMouvements_(feuille) {
  var enTetes = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
  var idx = {};
  enTetes.forEach(function (titre, i) {
    var t = String(titre).trim();
    if (t) idx[t] = i + 1;
  });
  return idx;
}

/*
 * ⚠️ SI TU AS DÉJÀ UNE FONCTION onEdit DANS LE PROJET
 * ───────────────────────────────────────────────────
 * Google n'appelle qu'UNE seule fonction nommée onEdit. Si une autre existe
 * déjà (ailleurs dans ton code), renomme CELLE-CI, par exemple en
 * filtrerDetailTransaction(e), puis appelle-la depuis ton onEdit unique :
 *
 *   function onEdit(e) {
 *     // ... ton code existant ...
 *     filtrerDetailTransaction(e);   // ajoute cet appel
 *   }
 *
 * Et renomme la fonction onEdit(e) ci-dessus en filtrerDetailTransaction(e).
 */