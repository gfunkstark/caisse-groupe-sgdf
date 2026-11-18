/**
 * code.gs
 * Caisse de camp — saisie des dépenses par les chefs
 * Groupe SGDF Saint Lambert de Vaugirard
 *
 * Un lien unique pour tout le groupe. Le code à 6 chiffres identifie le chef
 * et ouvre la caisse de son unité. Une session de 30 jours évite de le ressaisir.
 *
 * Onglet Paramètres :
 * A: Email | B: Prénom | C: Branche/Pôle | D: Budget camp | E: Code
 * La colonne E est remplie par le script.
 *
 * Déploiement : Exécuter en tant que « Moi », Qui a accès : « Tout le monde ».
 */

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

var CONFIG = {
  ONGLET_MOUVEMENTS: 'Mouvements',
  ONGLET_PARAMETRES: 'Paramètres',

  COLONNES: [
    'Horodatage',
    'Date',
    'Branche/Pôle',
    'Nature',
    'Libellé',
    'Dépense',
    'Recette',
    'Mode de paiement',
    'Justificatif',
    'Saisi par'
  ],

  DOSSIER_JUSTIFICATIFS_ID: '',
  URL_APP: '',  // ← Colle ici l'URL /exec de TON déploiement (voir README)
  HISTORIQUE: 8,

  LONGUEUR_CODE: 6,
  DUREE_SESSION_JOURS: 30,
  ESSAIS_APPAREIL: 8,
  ESSAIS_GLOBAUX: 60,
  BLOCAGE_MINUTES: 15,

  NATURES: [
    'Alimentation',
    'Transport',
    'Matériel',
    'Pharmacie',
    'Activités',
    'Hébergement',
    'Extra-Jobs',
    'Divers'
  ],

  MODES_PAIEMENT: ['Carte du groupe', 'Avance personnelle', 'Espèces', 'Virement', 'Chèque'],

  // Modes d'encaissement proposés pour les recettes (extra-jobs, participations…)
  MODES_RECETTE: ['SumUp', 'Espèces', 'Chèque', 'Virement'],

  // Natures proposées pour les recettes (le champ Nature bascule dessus en mode recette)
  NATURES_RECETTE: ['Babysitting', 'Vente de gâteaux', 'Extra-jobs', 'Autres recettes'],

  COULEURS_BRANCHE: {
    'Farfadets': '#6DC0A0',
    'Louveteaux': '#F18A1A',
    'Jeannettes': '#F18A1A',
    'Scouts': '#0F75A8',
    'Guides': '#0F75A8',
    'Pionniers': '#E63118',
    'Caravelles': '#E63118',
    'Compagnons': '#00815A',
    'RG': '#4B2E9E'
  }
};

var COL_EMAIL = 0, COL_PRENOM = 1, COL_BRANCHE = 2, COL_BUDGET = 3, COL_CODE = 4, COL_ENVOYE = 5;

function doGet(e) {
  // Déclenchement distant de la sauvegarde par le robot (jeton requis).
  if (e && e.parameter && e.parameter.action === 'backup') {
    return reponseJson_(executerBackupDistant_(e.parameter.token));
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Caisse d\'unité')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function reponseJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Lance backupJustificatifs si le jeton fourni par le robot est valide. */
function executerBackupDistant_(jeton) {
  var attendu = PropertiesService.getScriptProperties().getProperty('JETON_BACKUP');
  if (!attendu || String(jeton || '') !== attendu) {
    return { ok: false, erreur: 'Jeton invalide ou absent.' };
  }
  try {
    var r = backupJustificatifs();
    return { ok: true, resultat: r || {} };
  } catch (err) {
    return { ok: false, erreur: String(err && err.message || err) };
  }
}

function getContexte(session) {
  var ligne = ligneDeSession_(session);
  if (ligne === null) return { besoinCode: true };

  var fiche = ficheDeLigne_(ligne);
  if (!fiche) return { besoinCode: true };

  return contexteComplet_(fiche);
}

function validerCode(code, appareil) {
  var propre = String(code || '').replace(/\D/g, '');

  if (blocageActif_(appareil)) {
    throw new Error('Trop d\'essais. Réessaie dans ' + CONFIG.BLOCAGE_MINUTES + ' minutes.');
  }

  if (propre.length !== CONFIG.LONGUEUR_CODE) {
    throw new Error('Le code comporte ' + CONFIG.LONGUEUR_CODE + ' chiffres.');
  }

  var trouve = chercherParCode_(propre);

  if (trouve === null) {
    var reste = enregistrerEchec_(appareil);
    throw new Error(reste > 0
      ? 'Code inconnu. ' + reste + ' essai(s) restant(s).'
      : 'Code inconnu. Accès bloqué ' + CONFIG.BLOCAGE_MINUTES + ' minutes.');
  }

  reinitialiserEchecs_(appareil);

  var contexte = contexteComplet_(trouve.fiche);
  contexte.session = creerSession_(trouve.ligne);
  return contexte;
}

function contexteComplet_(fiche) {
  var totaux = calculerTotaux_(fiche.branche);

  return {
    prenom: fiche.prenom,
    branche: fiche.branche,
    budget: fiche.budget,
    engage: totaux.depenses,
    recettes: totaux.recettes,
    sansJustif: totaux.sansJustif,
    reste: fiche.budget - totaux.depenses + totaux.recettes,
    couleur: CONFIG.COULEURS_BRANCHE[fiche.branche] || '#1B4F8C',
    natures: CONFIG.NATURES,
    naturesRecette: CONFIG.NATURES_RECETTE,
    modesPaiement: CONFIG.MODES_PAIEMENT,
    modesRecette: CONFIG.MODES_RECETTE,
    dernieres: dernieresLignes_(fiche.branche, CONFIG.HISTORIQUE)
  };
}

function creerSession_(ligne) {
  var cle = 'sess_' + Utilities.getUuid().replace(/-/g, '');
  var expire = Date.now() + CONFIG.DUREE_SESSION_JOURS * 24 * 3600 * 1000;

  PropertiesService.getScriptProperties()
    .setProperty(cle, JSON.stringify({ l: ligne, exp: expire }));

  return cle;
}

function ligneDeSession_(session) {
  if (!session || String(session).indexOf('sess_') !== 0) return null;

  var brut = PropertiesService.getScriptProperties().getProperty(String(session));
  if (!brut) return null;

  try {
    var donnees = JSON.parse(brut);
    if (Date.now() > donnees.exp) {
      PropertiesService.getScriptProperties().deleteProperty(String(session));
      return null;
    }
    return donnees.l;
  } catch (e) {
    return null;
  }
}

function purgerSessions() {
  var props = PropertiesService.getScriptProperties();
  var toutes = props.getProperties();
  var supprimees = 0;

  for (var cle in toutes) {
    if (cle.indexOf('sess_') !== 0) continue;
    try {
      if (Date.now() > JSON.parse(toutes[cle]).exp) {
        props.deleteProperty(cle);
        supprimees++;
      }
    } catch (e) {
      props.deleteProperty(cle);
      supprimees++;
    }
  }

  try {
    SpreadsheetApp.getActive().toast(supprimees + ' session(s) expirée(s) supprimée(s).',
                                     'Caisse d\'unité', 5);
  } catch (e) { /* hors interface */ }
}

function revoquerToutesLesSessions() {
  var props = PropertiesService.getScriptProperties();
  var toutes = props.getProperties();
  var compte = 0;

  for (var cle in toutes) {
    if (cle.indexOf('sess_') !== 0) continue;
    props.deleteProperty(cle);
    compte++;
  }

  try {
    SpreadsheetApp.getActive().toast(compte + ' session(s) fermée(s).', 'Caisse d\'unité', 5);
  } catch (e) { /* hors interface */ }
}

function blocageActif_(appareil) {
  var cache = CacheService.getScriptCache();
  var parAppareil = Number(cache.get('ech_' + String(appareil))) || 0;
  var global = Number(cache.get('ech_global')) || 0;

  return parAppareil >= CONFIG.ESSAIS_APPAREIL || global >= CONFIG.ESSAIS_GLOBAUX;
}

function enregistrerEchec_(appareil) {
  var cache = CacheService.getScriptCache();
  var duree = CONFIG.BLOCAGE_MINUTES * 60;

  var cle = 'ech_' + String(appareil);
  var echecs = (Number(cache.get(cle)) || 0) + 1;
  cache.put(cle, String(echecs), duree);

  var global = (Number(cache.get('ech_global')) || 0) + 1;
  cache.put('ech_global', String(global), duree);

  return Math.max(0, CONFIG.ESSAIS_APPAREIL - echecs);
}

function reinitialiserEchecs_(appareil) {
  CacheService.getScriptCache().remove('ech_' + String(appareil));
}

function envoyerCodeParEmail(email) {
  var propre = String(email || '').trim().toLowerCase();
  if (!propre || propre.indexOf('@') < 1 || propre.indexOf('.') < 0) {
    throw new Error('Adresse email invalide.');
  }

  var cache = CacheService.getScriptCache();
  var cle = 'mail_' + propre;
  var demandes = Number(cache.get(cle)) || 0;
  if (demandes >= 3) {
    throw new Error('Trop de demandes pour cette adresse. Réessaie dans une heure.');
  }
  cache.put(cle, String(demandes + 1), 3600);

  var lignes = feuilleParametres_().getDataRange().getValues();
  var trouvees = [];

  for (var i = 1; i < lignes.length; i++) {
    if (String(lignes[i][COL_EMAIL] || '').trim().toLowerCase() !== propre) continue;
    var code = normaliserCode_(lignes[i][COL_CODE]);
    if (!code) continue;
    trouvees.push({
      prenom: String(lignes[i][COL_PRENOM] || '').trim(),
      branche: String(lignes[i][COL_BRANCHE] || '').trim(),
      code: code
    });
  }

  if (trouvees.length) {
    envoyerMailCode_(propre, trouvees);
  }

  return { ok: true };
}

function envoyerMailCode_(email, unites) {
  corpsMailCode_(email, unites, false);
}

/**
 * Construit et envoie le mail contenant le(s) code(s).
 * premier = true → « voici ton accès » ; false → « voici ton code » (renvoi).
 */
function corpsMailCode_(email, unites, premier) {
  var prenom = unites[0].prenom || '';
  var lien = CONFIG.URL_APP ||
             ScriptApp.getService().getUrl().replace(/\/dev$/, '/exec');

  var pluriel = unites.length > 1;
  var liste = unites.map(function (u) {
    return '• ' + u.branche + ' : ' + u.code;
  }).join('\n');

  var intro = premier
    ? 'Voici ton accès à la caisse d\'unité. ' +
      (pluriel ? 'Tu suis plusieurs unités — un code par unité :' : 'Ton code personnel à 6 chiffres :')
    : 'Voici ' + (pluriel ? 'tes codes' : 'ton code') + ' pour la caisse d\'unité :';

  var corps =
    'Bonjour ' + prenom + ',\n\n' +
    intro + '\n\n' +
    liste + '\n\n' +
    'Ouvre l\'application et saisis ' + (pluriel ? 'le code de ton unité' : 'ce code') + ' :\n' +
    lien + '\n\n' +
    (premier
      ? 'Astuce : ajoute la page à l\'écran d\'accueil de ton téléphone pour l\'avoir comme une appli. ' +
        'Ton code reste actif 30 jours.\n\n'
      : 'Le code reste actif 30 jours sur ton téléphone.\n\n') +
    'La trésorerie du groupe';

  MailApp.sendEmail({
    to: email,
    subject: (premier ? 'Ton accès' : (pluriel ? 'Tes codes' : 'Ton code')) + ' — Caisse d\'unité',
    body: corps
  });
}

function chercherParCode_(code) {
  var lignes = feuilleParametres_().getDataRange().getValues();

  for (var i = 1; i < lignes.length; i++) {
    if (normaliserCode_(lignes[i][COL_CODE]) !== code) continue;
    return { ligne: i + 1, fiche: construireFiche_(lignes[i]) };
  }
  return null;
}

function ficheDeLigne_(ligne) {
  var feuille = feuilleParametres_();
  if (ligne < 2 || ligne > feuille.getLastRow()) return null;

  var valeurs = feuille.getRange(ligne, 1, 1, COL_CODE + 1).getValues()[0];
  if (!String(valeurs[COL_BRANCHE] || '').trim()) return null;

  return construireFiche_(valeurs);
}

function construireFiche_(valeurs) {
  return {
    email: String(valeurs[COL_EMAIL] || '').trim(),
    prenom: String(valeurs[COL_PRENOM] || '').trim(),
    branche: String(valeurs[COL_BRANCHE] || '').trim(),
    budget: Number(valeurs[COL_BUDGET]) || 0
  };
}

function normaliserCode_(valeur) {
  var code = String(valeur == null ? '' : valeur).replace(/\D/g, '');
  if (!code) return '';
  while (code.length < CONFIG.LONGUEUR_CODE) code = '0' + code;
  return code;
}

function indexColonnes_() {
  return {
    horodatage: CONFIG.COLONNES.indexOf('Horodatage'),
    date:       CONFIG.COLONNES.indexOf('Date'),
    branche:    CONFIG.COLONNES.indexOf('Branche/Pôle'),
    nature:     CONFIG.COLONNES.indexOf('Nature'),
    libelle:    CONFIG.COLONNES.indexOf('Libellé'),
    depense:    CONFIG.COLONNES.indexOf('Dépense'),
    recette:    CONFIG.COLONNES.indexOf('Recette'),
    mode:       CONFIG.COLONNES.indexOf('Mode de paiement'),
    justif:     CONFIG.COLONNES.indexOf('Justificatif'),
    saisiPar:   CONFIG.COLONNES.indexOf('Saisi par')
  };
}

function empreinte_(horodatage) {
  if (Object.prototype.toString.call(horodatage) === '[object Date]') {
    return String(horodatage.getTime());
  }
  return String(horodatage || '');
}

function dateIso_(valeur) {
  if (Object.prototype.toString.call(valeur) === '[object Date]') {
    return Utilities.formatDate(valeur, 'Europe/Paris', 'yyyy-MM-dd');
  }
  return '';
}

function calculerTotaux_(branche) {
  var lignes = feuilleMouvements_().getDataRange().getValues();
  var idx = indexColonnes_();
  var depenses = 0, recettes = 0, sansJustif = 0;

  for (var i = 1; i < lignes.length; i++) {
    if (String(lignes[i][idx.branche]).trim() !== branche) continue;

    var dep = Number(lignes[i][idx.depense]) || 0;
    depenses += dep;
    recettes += Number(lignes[i][idx.recette]) || 0;

    // Une dépense sans justificatif est à compléter.
    if (dep > 0 && !String(lignes[i][idx.justif] || '').trim()) sansJustif++;
  }
  return { depenses: depenses, recettes: recettes, sansJustif: sansJustif };
}

function dernieresLignes_(branche, combien) {
  var lignes = feuilleMouvements_().getDataRange().getValues();
  var idx = indexColonnes_();
  var resultat = [];

  for (var i = lignes.length - 1; i >= 1 && resultat.length < combien; i--) {
    if (String(lignes[i][idx.branche]).trim() !== branche) continue;

    resultat.push({
      ligne: i + 1,
      empreinte: empreinte_(lignes[i][idx.horodatage]),
      date: formaterDate_(lignes[i][idx.date]),
      dateIso: dateIso_(lignes[i][idx.date]),
      nature: lignes[i][idx.nature],
      libelle: lignes[i][idx.libelle],
      depense: Number(lignes[i][idx.depense]) || 0,
      recette: Number(lignes[i][idx.recette]) || 0,
      modePaiement: lignes[i][idx.mode] || '',
      justificatif: lignes[i][idx.justif] || ''
    });
  }
  return resultat;
}

function enregistrerMouvement(saisie, session) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);

  try {
    var fiche = chefDeSession_(session);
    var montant = montantValide_(saisie.montant);
    var libelle = libelleValide_(saisie.libelle);

    var idx = indexColonnes_();
    var valeurs = {
      'Horodatage': new Date(),
      'Date': saisie.date ? new Date(saisie.date) : new Date(),
      'Branche/Pôle': fiche.branche,
      'Nature': saisie.nature || 'Divers',
      'Libellé': libelle,
      'Dépense': saisie.sens === 'recette' ? '' : montant,
      'Recette': saisie.sens === 'recette' ? montant : '',
      'Mode de paiement': saisie.modePaiement || '',
      'Justificatif': enregistrerJustificatifs_(saisie, fiche.branche, libelle),
      'Saisi par': fiche.prenom + (fiche.email ? ' (' + fiche.email + ')' : '')
    };

    var ligne = CONFIG.COLONNES.map(function (colonne) {
      return valeurs.hasOwnProperty(colonne) ? valeurs[colonne] : '';
    });

    feuilleMouvements_().appendRow(ligne);
    return etatCaisse_(fiche);

  } finally {
    verrou.releaseLock();
  }
}

function modifierMouvement(charge, session) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);

  try {
    var fiche = chefDeSession_(session);
    var montant = montantValide_(charge.montant);
    var libelle = libelleValide_(charge.libelle);

    var feuille = feuilleMouvements_();
    var idx = indexColonnes_();
    var plage = plageVerifiee_(feuille, charge.ligne, charge.empreinte, fiche.branche, idx);
    var valeurs = plage.getValues()[0];

    var justif = String(charge.justificatifsConserves || '');
    var ajouts = enregistrerJustificatifs_(charge, fiche.branche, libelle);
    if (ajouts) justif = justif ? justif + '\n' + ajouts : ajouts;

    if (charge.date) valeurs[idx.date] = new Date(charge.date);
    valeurs[idx.nature]  = charge.nature || 'Divers';
    valeurs[idx.libelle] = libelle;
    valeurs[idx.depense] = charge.sens === 'recette' ? '' : montant;
    valeurs[idx.recette] = charge.sens === 'recette' ? montant : '';
    valeurs[idx.mode]    = charge.modePaiement || '';
    valeurs[idx.justif]  = justif;

    plage.setValues([valeurs]);
    return etatCaisse_(fiche);

  } finally {
    verrou.releaseLock();
  }
}

function supprimerMouvement(numero, empreinte, session) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);

  try {
    var fiche = chefDeSession_(session);
    var feuille = feuilleMouvements_();
    var idx = indexColonnes_();

    plageVerifiee_(feuille, numero, empreinte, fiche.branche, idx);
    feuille.deleteRow(Number(numero));

    return etatCaisse_(fiche);

  } finally {
    verrou.releaseLock();
  }
}

function chefDeSession_(session) {
  var ligne = ligneDeSession_(session);
  if (ligne === null) {
    throw new Error('Session expirée. Recharge la page et ressaisis ton code.');
  }

  var fiche = ficheDeLigne_(ligne);
  if (!fiche) throw new Error('Ton accès a été modifié. Contacte le trésorier de groupe.');

  return fiche;
}

function montantValide_(brut) {
  var montant = Math.abs(Number(String(brut).replace(',', '.')));
  if (!montant || isNaN(montant)) throw new Error('Le montant est vide ou invalide.');
  return montant;
}

function libelleValide_(brut) {
  var libelle = String(brut || '').trim();
  if (!libelle) throw new Error('Le libellé est obligatoire.');
  return libelle;
}

function plageVerifiee_(feuille, numero, empreinte, branche, idx) {
  var ligne = Number(numero);

  if (!ligne || ligne < 2 || ligne > feuille.getLastRow()) {
    throw new Error('Ligne introuvable. Recharge la page.');
  }

  var plage = feuille.getRange(ligne, 1, 1, CONFIG.COLONNES.length);
  var valeurs = plage.getValues()[0];

  if (String(valeurs[idx.branche]).trim() !== branche) {
    throw new Error('Cette ligne appartient à une autre unité.');
  }
  if (empreinte_(valeurs[idx.horodatage]) !== String(empreinte)) {
    throw new Error('Cette ligne a changé entre-temps. Recharge la page.');
  }

  return plage;
}

function etatCaisse_(fiche) {
  var totaux = calculerTotaux_(fiche.branche);
  return {
    ok: true,
    engage: totaux.depenses,
    recettes: totaux.recettes,
    sansJustif: totaux.sansJustif,
    reste: fiche.budget - totaux.depenses + totaux.recettes,
    dernieres: dernieresLignes_(fiche.branche, CONFIG.HISTORIQUE)
  };
}

function enregistrerJustificatifs_(saisie, branche, libelle) {
  var fichiers = [];

  if (saisie.fichiers && saisie.fichiers.length) {
    fichiers = saisie.fichiers;
  } else if (saisie.fichier && saisie.fichier.donnees) {
    fichiers = [saisie.fichier];
  }

  if (!fichiers.length) return '';

  var dossier = sousDossier_(dossierJustificatifs_(), branche);
  var liens = [];

  for (var i = 0; i < fichiers.length; i++) {
    var fichier = fichiers[i];
    if (!fichier || !fichier.donnees) continue;

    var suffixe = fichiers.length > 1 ? '_' + (i + 1) : '';
    liens.push(deposerFichier_(fichier, dossier, branche, libelle, suffixe));
  }

  return liens.join('\n');
}

function deposerFichier_(fichier, dossier, branche, libelle, suffixe) {
  var octets = Utilities.base64Decode(fichier.donnees);
  var horodatage = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd_HHmmss');
  var extension = (fichier.nom && fichier.nom.indexOf('.') > -1)
    ? fichier.nom.substring(fichier.nom.lastIndexOf('.'))
    : '.jpg';

  var nom = branche + '_' + horodatage + '_' + nettoyer_(libelle) + suffixe + extension;
  var blob = Utilities.newBlob(octets, fichier.type, nom);

  return dossier.createFile(blob).getUrl();
}

function dossierJustificatifs_() {
  if (CONFIG.DOSSIER_JUSTIFICATIFS_ID) {
    return DriveApp.getFolderById(CONFIG.DOSSIER_JUSTIFICATIFS_ID);
  }

  var proprietes = PropertiesService.getScriptProperties();
  var memorise = proprietes.getProperty('DOSSIER_JUSTIFICATIFS');

  if (memorise) {
    try { return DriveApp.getFolderById(memorise); } catch (e) { /* recréé ci-dessous */ }
  }

  var parents = DriveApp.getFileById(classeur_().getId()).getParents();
  var racine = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var dossier = racine.createFolder('Justificatifs');
  proprietes.setProperty('DOSSIER_JUSTIFICATIFS', dossier.getId());
  return dossier;
}

function sousDossier_(parent, nom) {
  var existants = parent.getFoldersByName(nom);
  return existants.hasNext() ? existants.next() : parent.createFolder(nom);
}

function genererCodes() {
  var feuille = feuilleParametres_();
  var lignes = feuille.getDataRange().getValues();
  var i;

  if (String(lignes[0][COL_CODE] || '').trim() === '') {
    feuille.getRange(1, COL_CODE + 1).setValue('Code').setFontWeight('bold');
  }

  feuille.getRange(2, COL_CODE + 1, Math.max(1, feuille.getMaxRows() - 1), 1)
         .setNumberFormat('@');

  var existants = {};
  for (i = 1; i < lignes.length; i++) {
    var deja = normaliserCode_(lignes[i][COL_CODE]);
    if (deja) existants[deja] = true;
  }

  var attribues = 0;
  for (i = 1; i < lignes.length; i++) {
    if (!String(lignes[i][COL_BRANCHE] || '').trim()) continue;
    if (normaliserCode_(lignes[i][COL_CODE])) continue;

    var code;
    do { code = codeAleatoire_(); } while (existants[code]);
    existants[code] = true;

    feuille.getRange(i + 1, COL_CODE + 1).setValue(code);
    attribues++;
  }

  SpreadsheetApp.flush();

  try {
    SpreadsheetApp.getActive().toast(attribues + ' code(s) attribué(s).', 'Caisse d\'unité', 5);
  } catch (e) { /* hors interface */ }
}

function renouvelerCodeSelection() {
  var feuille = feuilleParametres_();
  var ui = SpreadsheetApp.getUi();
  var ligne = feuille.getActiveRange().getRow();

  if (ligne < 2) {
    ui.alert('Sélectionne d\'abord la ligne du chef concerné.');
    return;
  }

  var code = codeAleatoire_();
  feuille.getRange(ligne, COL_CODE + 1).setNumberFormat('@').setValue(code);
  SpreadsheetApp.flush();

  ui.alert('Nouveau code',
           feuille.getRange(ligne, COL_PRENOM + 1).getValue() + ' : ' + code +
           '\n\nL\'ancien code ne fonctionne plus. La session déjà ouverte sur son ' +
           'téléphone reste valable jusqu\'à expiration.',
           ui.ButtonSet.OK);
}

function afficherLien() {
  var lien = CONFIG.URL_APP ||
             ScriptApp.getService().getUrl().replace(/\/dev$/, '/exec');

  Logger.log(lien);

  try {
    var ui = SpreadsheetApp.getUi();
    ui.alert('Lien de l\'application', lien, ui.ButtonSet.OK);
  } catch (e) { /* hors interface */ }
}

function codeAleatoire_() {
  var code = '';
  for (var i = 0; i < CONFIG.LONGUEUR_CODE; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

/**
 * Envoie à la ligne sélectionnée un mail avec son code et le lien.
 * À utiliser après avoir créé la ligne et généré le code.
 */
function envoyerAccesSelection() {
  var feuille = feuilleParametres_();
  var ui = SpreadsheetApp.getUi();
  var ligne = feuille.getActiveRange().getRow();

  if (ligne < 2) {
    ui.alert('Sélectionne d\'abord la ligne du chef à qui envoyer l\'accès.');
    return;
  }

  var valeurs = feuille.getRange(ligne, 1, 1, COL_CODE + 1).getValues()[0];
  var email = String(valeurs[COL_EMAIL] || '').trim();
  var prenom = String(valeurs[COL_PRENOM] || '').trim();
  var branche = String(valeurs[COL_BRANCHE] || '').trim();
  var code = normaliserCode_(valeurs[COL_CODE]);

  if (!email || email.indexOf('@') < 1) {
    ui.alert('Cette ligne n\'a pas d\'adresse email valide (colonne A).');
    return;
  }
  if (!branche) {
    ui.alert('Cette ligne n\'a pas d\'unité (colonne C).');
    return;
  }
  if (!code) {
    ui.alert('Cette ligne n\'a pas encore de code.\n\n' +
             'Lance d\'abord « Générer les codes manquants » ou « Renouveler le code ».');
    return;
  }

  var confirme = ui.alert(
    'Envoyer l\'accès',
    'Envoyer un mail à ' + prenom + ' (' + email + ')\n' +
    'avec le code de l\'unité ' + branche + ' et le lien de l\'appli ?',
    ui.ButtonSet.OK_CANCEL);
  if (confirme !== ui.Button.OK) return;

  try {
    corpsMailCode_(email, [{ prenom: prenom, branche: branche, code: code }], true);
  } catch (e) {
    ui.alert('Échec de l\'envoi', String(e.message || e), ui.ButtonSet.OK);
    return;
  }

  if (String(feuille.getRange(1, COL_ENVOYE + 1).getValue() || '').trim() === '') {
    feuille.getRange(1, COL_ENVOYE + 1).setValue('Envoyé le').setFontWeight('bold');
  }
  var quand = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm');
  feuille.getRange(ligne, COL_ENVOYE + 1).setValue(quand);
  SpreadsheetApp.flush();

  ui.alert('Envoyé', 'Accès envoyé à ' + prenom + ' (' + email + ').', ui.ButtonSet.OK);
}

function classeur_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function feuilleParametres_() {
  var feuille = classeur_().getSheetByName(CONFIG.ONGLET_PARAMETRES);
  if (!feuille) throw new Error('Onglet "' + CONFIG.ONGLET_PARAMETRES + '" introuvable.');
  return feuille;
}

function feuilleMouvements_() {
  var feuille = classeur_().getSheetByName(CONFIG.ONGLET_MOUVEMENTS);
  if (!feuille) throw new Error('Onglet "' + CONFIG.ONGLET_MOUVEMENTS + '" introuvable.');
  return feuille;
}

function formaterDate_(valeur) {
  if (!valeur) return '';
  if (Object.prototype.toString.call(valeur) === '[object Date]') {
    return Utilities.formatDate(valeur, 'Europe/Paris', 'dd/MM');
  }
  return String(valeur);
}

function nettoyer_(texte) {
  return String(texte)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .substring(0, 40);
}

function initialiserClasseur() {
  var ss = classeur_();

  var mouvements = ss.getSheetByName(CONFIG.ONGLET_MOUVEMENTS) || ss.insertSheet(CONFIG.ONGLET_MOUVEMENTS);
  if (mouvements.getLastRow() === 0) {
    mouvements.appendRow(CONFIG.COLONNES);
    mouvements.getRange(1, 1, 1, CONFIG.COLONNES.length).setFontWeight('bold');
    mouvements.setFrozenRows(1);
  }

  var parametres = ss.getSheetByName(CONFIG.ONGLET_PARAMETRES) || ss.insertSheet(CONFIG.ONGLET_PARAMETRES);
  if (parametres.getLastRow() === 0) {
    parametres.appendRow(['Email', 'Prénom', 'Branche/Pôle', 'Budget camp', 'Code']);
    parametres.getRange(1, 1, 1, 5).setFontWeight('bold');
    parametres.setFrozenRows(1);
  }
}

function reinitialiserBlocageMail() {
  var ui = SpreadsheetApp.getUi();
  var reponse = ui.prompt(
    'Débloquer le renvoi de code',
    'Adresse email du chef à débloquer :',
    ui.ButtonSet.OK_CANCEL);

  if (reponse.getSelectedButton() !== ui.Button.OK) return;

  var email = String(reponse.getResponseText() || '').trim().toLowerCase();
  if (!email || email.indexOf('@') < 1) {
    ui.alert('Adresse invalide.');
    return;
  }

  CacheService.getScriptCache().remove('mail_' + email);
  ui.alert('Débloqué', email + ' peut de nouveau demander son code.', ui.ButtonSet.OK);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Caisse d\'unité')
    .addItem('Générer les codes manquants', 'genererCodes')
    .addItem('Afficher le lien de l\'app', 'afficherLien')
    .addSeparator()
    .addItem('Renouveler le code (ligne sélectionnée)', 'renouvelerCodeSelection')
    .addItem('Envoyer l\'accès par mail (ligne sélectionnée)', 'envoyerAccesSelection')
    .addItem('Débloquer le renvoi de code (email)', 'reinitialiserBlocageMail')
    .addItem('Purger les sessions expirées', 'purgerSessions')
    .addItem('Fermer toutes les sessions', 'revoquerToutesLesSessions')
    .addSeparator()
    .addItem('Préparer l\'onglet Mouvements', 'creerPageMouvements')
    .addItem('Sauvegarder les justificatifs', 'backupJustificatifs')
    .addItem('Activer la sauvegarde automatique des justificatifs', 'installerBackupAutomatique')
    .addItem('Définir le jeton de sauvegarde (robot)', 'definirJetonBackup')
    .addToUi();
}