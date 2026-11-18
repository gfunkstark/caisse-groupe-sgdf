/**
 * ═══════════════════════════════════════════════════════════════════════
 *  BACKUP DES JUSTIFICATIFS — par numéro de pièce
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Copie, dans le dossier de backup, les justificatifs des lignes de l'onglet
 *  Mouvements qui ont été comptabilisées (N° de pièce rempli) mais dont les
 *  pièces ne sont pas encore sauvegardées (colonne "Justif sauvés" vide).
 *
 *  Chaque fichier est copié et renommé avec le n° de pièce :
 *     20261004_1.jpg, 20261004_1_b.jpg, ...  (suffixe si plusieurs pièces)
 *
 *  Tourne sous TON compte Google (propriétaire de la caisse), qui a le quota
 *  Drive et accès aux justificatifs — contrairement au service account du
 *  script Python, qui ne peut pas copier (storageQuotaExceeded).
 *
 *  ── Installation ──
 *  Colle dans le projet Apps Script de la caisse. Ajuste BACKUP_FOLDER_ID.
 *  Ajoute au menu onOpen :
 *     .addItem('Sauvegarder les justificatifs', 'backupJustificatifs')
 *  (ou crée un déclencheur horaire pour l'automatiser).
 *
 *  Dépend de CONFIG (ONGLET_MOUVEMENTS) et classeur_().
 * ═══════════════════════════════════════════════════════════════════════
 */

// Dossier Drive où ranger les justificatifs renommés par n° de pièce
var BACKUP_FOLDER_ID = '';  // ← ID du dossier Drive de back-up de TON groupe

// Colonnes utilisées (libellés EXACTS de l'onglet Mouvements)
var BK_COL = {
  justif: 'Justificatif',
  npiece: 'N° de pièce',
  sauves: 'Justif sauvés'   // créée automatiquement si absente
};

function backupJustificatifs() {
  var ui = (function () { try { return SpreadsheetApp.getUi(); } catch (e) { return null; } })();
  var feuille = classeur_().getSheetByName(CONFIG.ONGLET_MOUVEMENTS);
  if (!feuille) {
    if (ui) ui.alert('Onglet Mouvements introuvable.');
    return;
  }

  var lignes = feuille.getDataRange().getValues();
  var entetes = lignes[0].map(function (v) { return String(v).trim(); });

  var iJustif  = entetes.indexOf('Justificatif');
  var iPiece   = entetes.indexOf('N° de pièce');
  var iSauves  = entetes.indexOf('Justif sauvés');
  var iBranche = entetes.indexOf('Branche compta');
  var iActiv   = entetes.indexOf('Activité');
  var iLibelle = entetes.indexOf('Libellé');

  if (iJustif === -1 || iPiece === -1) {
    if (ui) ui.alert('Colonnes « Justificatif » et « N° de pièce » requises.');
    return;
  }

  if (iSauves === -1) {
    iSauves = entetes.length;
    feuille.getRange(1, iSauves + 1).setValue('Justif sauvés').setFontWeight('bold');
  }

  var dossier = DriveApp.getFolderById(BACKUP_FOLDER_ID);
  var suffixes = ['', '_b', '_c', '_d', '_e'];
  var traites = 0, copiesTotal = 0;

  for (var r = 1; r < lignes.length; r++) {
    var piece  = String(lignes[r][iPiece]  || '').trim();
    var sauves = String(lignes[r][iSauves] || '').trim();
    var justif = String(lignes[r][iJustif] || '').trim();

    if (!piece || sauves || !justif) continue;

    // Construit la partie "descriptive" du nom : Branche - Activité - Libellé
    var parts = [];
    if (iBranche > -1) { var b = String(lignes[r][iBranche] || '').trim(); if (b) parts.push(b); }
    if (iActiv   > -1) { var a = String(lignes[r][iActiv]   || '').trim(); if (a) parts.push(a); }
    if (iLibelle > -1) { var l = String(lignes[r][iLibelle] || '').trim(); if (l) parts.push(l); }
    var description = parts.join(' - ');
    var baseNom = piece + (description ? ' - ' + description : '');
    baseNom = nettoyerNomFichier_(baseNom);

    var liens = justif.split('\n').filter(function (x) { return x.trim(); });
    var copies = 0;

    for (var i = 0; i < liens.length; i++) {
      var id = extraireIdDrive_(liens[i]);
      if (!id) continue;
      try {
        var fichier = DriveApp.getFileById(id);
        var nomSource = fichier.getName();
        var ext = '';
        var pt = nomSource.lastIndexOf('.');
        if (pt > -1) ext = nomSource.substring(pt);

        var suffixe = (i < suffixes.length) ? suffixes[i] : ('_' + (i + 1));
        var nouveauNom = baseNom + suffixe + ext;

        fichier.makeCopy(nouveauNom, dossier);
        copies++;
      } catch (e) { /* fichier inaccessible : on continue */ }
    }

    var quand = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm');
    feuille.getRange(r + 1, iSauves + 1).setValue(quand + ' (' + copies + ')');
    traites++;
    copiesTotal += copies;
  }

  SpreadsheetApp.flush();
  var msg = traites + ' ligne(s) sauvegardée(s), ' + copiesTotal + ' fichier(s) copié(s).';
  if (ui) ui.alert('Backup justificatifs', msg, ui.ButtonSet.OK);
  else Logger.log(msg);
}

function extraireIdDrive_(url) {
  url = String(url).trim();
  var marqueurs = ['/d/', 'id='];
  for (var k = 0; k < marqueurs.length; k++) {
    var m = marqueurs[k];
    if (url.indexOf(m) > -1) {
      var reste = url.split(m)[1];
      return reste.split('/')[0].split('&')[0].split('?')[0];
    }
  }
  return (url && url.indexOf('/') === -1) ? url : '';
}

function nettoyerNomFichier_(nom) {
  // Retire les caractères problématiques pour un nom de fichier
  return String(nom)
    .replace(/[\/\\:*?"<>|]/g, ' ')  // caractères interdits
    .replace(/\s+/g, ' ')            // espaces multiples
    .trim()
    .substring(0, 200);              // limite raisonnable
}