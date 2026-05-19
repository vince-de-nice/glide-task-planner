export const fr = {
  app: {
    title: 'Glide Task Planner',
    tagline: 'Composition et export de tâches planeur',
    nav: {
      circuit: 'Circuit',
      waypoints: 'Waypoints',
      mainAria: 'Navigation principale'
    },
    lang: {
      switch: 'Langue',
      fr: 'FR',
      en: 'EN'
    },
    footer: 'Glide Task Planner'
  },
  common: {
    yes: 'Oui',
    no: 'Non',
    save: 'Enregistrer',
    cancel: 'Annuler',
    close: 'Fermer',
    delete: 'Supprimer',
    confirm: 'Confirmation',
    loading: 'Chargement…',
    all: 'Tous',
    done: 'Terminé',
    modify: 'Modifier',
    remove: 'Retirer',
    export: 'Exporter',
    import: 'Importer',
    load: 'Charger',
    preview: 'Aperçu',
    download: 'Télécharger',
    filter: 'Filtrer…',
    choose: '— Choisir —',
    offTask: 'hors tâche',
    compliant: 'Conforme au règlement',
    reorder: 'Réordonner'
  },
  circuit: {
    title: 'Circuit',
    taskDistance: 'Distance tâche',
    total: 'Total',
    pointsMetric: 'Points',
    pointsCount: '{{count}} pt(s)',
    tabs: {
      map: 'Carte',
      circuit: 'Circuit',
      circuitWithCount: 'Circuit ({{count}})'
    },
    sections: {
      points: 'Points',
      regulation: 'Règlement',
      regulationWithErrors: 'Règlement ({{count}})',
      export: 'Export',
      exportBlocked: 'Export · bloqué'
    },
    points: {
      panelAria: 'Points du circuit',
      hint:
        'Décollage et atterrissage sur aérodromes (1<sup>er</sup> / dernier) · distance hors branches déco/attero',
      add: 'Ajouter des points',
      addTooltip: 'Chargez d\'abord une base CUP',
      loading: 'Points en cours de chargement depuis la base…',
      empty: 'Aucun point dans la tâche — ajoutez-en depuis la base ou la carte.',
      zoneAltitude: 'Zone et altitude'
    },
    role: {
      departure: 'Décollage',
      arrival: 'Atterrissage',
      turnpoint: 'Virage'
    },
    regulation: {
      panelAria: 'Règlement',
      statusOk: 'Circuit conforme au règlement',
      statusWarn: '{{count}} avertissement(s)',
      statusError: '{{count}} erreur(s) de conformité',
      errors: 'Erreurs',
      warnings: 'Avertissements',
      legCheck: 'Points du circuit'
    },
    export: {
      panelAria: 'Export',
      fixRegulation: 'Corriger le règlement',
      taskNamePlaceholder: 'Circuit_500K',
      myCircuits: 'Mes circuits',
      previewExport: 'Aperçu export',
      clearTask: 'Vider la tâche',
      statusEmpty: 'Ajoutez des points pour exporter',
      statusBlocked: 'Export bloqué — règlement non respecté',
      statusReady: 'Prêt à exporter · {{label}}',
      sectionTask: 'Tâche',
      taskNameLabel: 'Nom de tâche (NEWTASK)',
      sectionPilot: 'Pilote et planeur',
      pilotEmpty: 'Non renseigné — requis pour un export FLARM complet',
      sectionFormats: 'Formats de fichier',
      flarmHint: 'FLARM : redémarrer l’appareil après copie sur SD/USB.',
      sectionLibrary: 'Bibliothèque',
      taskMeta: '{{task}} km tâche',
      taskMetaTotal: ' · {{total}} km total',
      taskMetaPoints: ' · {{count}} point(s)',
      formatFlarmDetail: 'flarmcfg.txt — SD/USB',
      formatCupDetail: 'Waypoints + tâche',
      formatCupxDetail: 'Archive POINTS.CUP',
      formatTskDetail: 'Fichier .tsk',
      formatIgcDetail: 'Trace déclarée',
      profileApplied: 'Règlement appliqué',
      chooseProfile: 'Choisir un règlement',
      radiiTitle: 'Rayons des zones (m)',
      startCupTitle: 'Départ et options CUP'
    },
    clearConfirm: 'Retirer tous les points du circuit ?',
    clearTaskHeader: 'Vider la tâche',
    clearTaskAccept: 'Vider',
    exportFailed: 'Export impossible',
    exportDone: 'Fichier exporté',
    exportDoneTitle: 'Export terminé',
    circuitSaved: 'Circuit enregistré dans la bibliothèque.',
    circuitUpdated: 'Circuit mis à jour.',
    saveFailed: 'Enregistrement impossible.',
    circuitLoaded: 'Circuit chargé — vérifiez pilote / planeur puis exportez le FLARM.',
    waypointAddedTurn: '« {{name}} » ajouté comme point de virage',
    panelsAria: 'Panneaux',
    circuitPanelAria: 'Circuit et export'
  },
  cup: {
    panelAria: 'Base de points',
    changeBase: 'Changer de base',
    actionsAria: 'Actions base',
    sourcePlaceholder: 'Source connue…',
    urlPlaceholder: 'URL du fichier .cup',
    load: 'Charger',
    importCup: 'Importer .cup',
    exportCup: 'Exporter .cup',
    importConfirm: 'Importer « {{name}} » remplacera les points actuels. Continuer ?',
    importHeader: 'Importer la base CUP',
    loaded: 'Base CUP chargée',
    loadedDetail: '{{count}} point(s)',
    replaceHeader: 'Remplacer la base',
    replaceFileMessage: 'Importer « {{name}} » remplacera les points actuels. Continuer ?',
    replaceUrlMessage: 'Charger cette base remplacera les {{count}} points actuels. Continuer ?',
    configError: 'Configuration des sources CUP indisponible',
    noWaypoints: 'Aucun waypoint trouvé dans le fichier',
    loadFailed: 'Échec du chargement'
  },
  waypoints: {
    title: 'Gestion des waypoints',
    hint: 'Pour composer une tâche FLARM, utilisez la page',
    declarationLink: 'Déclaration',
    page: '',
    importCup: 'Importer .cup',
    exportCup: 'Exporter .cup',
    clearAll: 'Tout effacer',
    add: 'Ajouter',
    close: 'Fermer',
    formNew: 'Nouveau waypoint',
    formEdit: 'Modifier le waypoint',
    name: 'Nom',
    type: 'Type',
    latitude: 'Latitude',
    longitude: 'Longitude',
    elevation: 'Altitude (m)',
    description: 'Description',
    count: '{{count}} waypoint(s)',
    results: '{{shown}} résultat(s) sur {{total}}',
    searchPlaceholder: 'Rechercher nom, code, type, coordonnées…',
    clearSearch: 'Effacer la recherche',
    pagerAria: 'Pagination des waypoints',
    perPage: 'Par page',
    empty: 'Aucun waypoint. Chargez une base sur la page Déclaration ou ajoutez-en manuellement.',
    noSearch: 'Aucun waypoint ne correspond à la recherche.',
    deleteConfirm: 'Supprimer ce waypoint ?',
    deleteHeader: 'Supprimer le waypoint',
    deleted: 'Waypoint supprimé',
    exportDone: 'Export CUP téléchargé',
    importHeader: 'Importer la base CUP',
    importConfirm: 'Importer « {{name}} » remplacera les points actuels. Continuer ?',
    imported: 'Base CUP importée',
    importError: 'Fichier CUP invalide ou illisible',
    clearHeader: 'Effacer tous les waypoints',
    clearConfirm: 'Effacer tous les waypoints ? Cette action est irréversible.',
    clearAccept: 'Tout effacer',
    cleared: 'Tous les waypoints ont été effacés',
    sortBy: 'Trier par {{field}}',
    sortActive: 'Tri par {{field}}, {{dir}}',
    sortAsc: 'croissant',
    sortDesc: 'décroissant',
    update: 'Mettre à jour',
    sort: {
      name: 'nom',
      type: 'type',
      latitude: 'latitude',
      longitude: 'longitude',
      elevation: 'altitude'
    }
  },
  picker: {
    title: 'Choisir des points',
    search: 'Rechercher nom, code…',
    filtersAria: 'Filtres',
    listAria: 'Page {{page}}',
    pagerAria: 'Pagination des points',
    perPage: 'Par page',
    results: '{{count}} résultat(s)',
    empty: 'Aucun point ne correspond.'
  },
  map: {
    centerTask: 'Centrer tâche',
    centerAll: 'Centrer tous les points',
    clearSelection: 'Effacer la sélection',
    region: 'Région',
    filtersAria: 'Afficher sur la carte',
    helpTitle: 'Aide carte',
    helpTooltip:
      'Zones tâche : cylindres/secteurs/lignes en mètres réels · espaces aériens POAFF/OpenAIP · noms au zoom ≥ 11 · double-clic : point · clic : menu',
    clearTaskHeader: 'Effacer la tâche',
    clearTaskMessage: 'Retirer tous les points du circuit affiché sur la carte ?',
    deleteFromDbHeader: 'Supprimer le point',
    deleteFromDbMessage: 'Supprimer « {{name}} » de la base ?'
  },
  pilot: {
    title: 'Pilote & planeur',
    name: 'Nom pilote',
    namePlaceholder: 'Jean Dupont',
    glider: 'Planeur',
    gliderPlaceholder: 'JS1-C',
    reg: 'Immatriculation',
    regPlaceholder: 'F-CINE',
    compId: 'ID compétition',
    compIdPlaceholder: 'ZX',
    class: 'Classe',
    classPlaceholder: 'Standard'
  },
  dialogs: {
    myCircuits: 'Mes circuits',
    exportPreview: 'Aperçu export',
    legZoneSave: 'Enregistrer',
    waypointEditSave: 'Enregistrer'
  },
  library: {
    namePlaceholder: 'Nom du circuit (ex. 500 km Vinon)',
    notesPlaceholder: 'Note (pilote, machine…)',
    deleteConfirm: 'Supprimer ce circuit ?',
    deleted: 'Circuit supprimé',
    importMerge: 'Fusionner avec les circuits existants ?',
    imported: '{{count}} circuit(s) importé(s)',
    importError: 'Fichier JSON invalide'
  },
  regulation: {
    panelAria: 'Règlement de la tâche',
    choose: 'Choisir un règlement',
    appliedLabel: 'Règlement appliqué',
    radiiTitle: 'Rayons des zones (m)',
    startCupTitle: 'Départ et options CUP',
    applyToPoints: 'Appliquer le règlement aux points',
    applyConfirm: 'Remplacer les zones et options du circuit selon le règlement sélectionné ?',
    applied: 'Règlement appliqué',
    appliedDetail: 'Profil et zones mis à jour.',
    zonesUpdated: 'Zones mises à jour',
    zonesUpdatedDetail: 'Rayons et préréglages du règlement appliqués.',
    taskTimePlaceholder: '12:30:00',
    changeProfileHeader: 'Changer de règlement',
    changeProfileMessage:
      'Appliquer les valeurs par défaut du profil (rayons et zones) à tous les points du circuit ?',
    applyProfileYes: 'Oui, appliquer',
    applyProfileNo: 'Non, garder les zones',
    scoringTooltip:
      'L’app prépare les fichiers de déclaration. Le scoring officiel (trace IGC, PEV sur enregistreur principal) reste du ressort du scorer. FLARM : waypoints sans zones.',
    startKind: {
      line: 'Ligne',
      cylinder: 'Cylindre'
    },
    profiles: {
      club: {
        label: 'Club (libre)',
        description:
          'Lignes de départ/arrivée par défaut, aérodromes recommandés. Export possible avec avertissements.'
      },
      seeyou_standard: {
        label: 'SeeYou standard',
        description:
          'Options CUP classiques : WpDis=False, tolérances NearDis/NearAlt, lignes départ/arrivée.'
      },
      fai_line_pev: {
        label: 'FAI — Ligne + PEV',
        description:
          'Championnat : aérodromes obligatoires, ligne de départ, PEV 5–10 min (Annexe A §7.4.3).'
      },
      fai_cylinder_start: {
        label: 'FAI — Cylindre départ',
        description:
          'Démarrage cylindre ≥ 10 km (Annexe A §7.4.4), PEV possible, aérodromes obligatoires.'
      },
      custom: {
        label: 'Personnalisé',
        description: 'Rayons, zones et contraintes ajustables manuellement.'
      }
    }
  },
  zone: {
    line: 'Ligne {{meters}} m',
    sectorKm: 'Secteur {{km}} km',
    sectorDeg: 'Secteur {{deg}}° · {{meters}} m',
    cylSym: 'Cyl. sym. {{meters}} m',
    cyl: 'Cyl. {{meters}} m'
  },
  rules: {
    emptyCircuit: 'Le circuit est vide.',
    requireDepartureAirfield: 'Un aérodrome de décollage est requis pour ce règlement.',
    requireArrivalAirfield: 'Un aérodrome d\'atterrissage est requis pour ce règlement.',
    minTurnpoints: 'Au moins un point de virage est requis.',
    pevWaitRange: 'PEV Wait : {{min}}–{{max}} min (Annexe A).',
    pevWindowRange: 'PEV Window : {{min}}–{{max}} min (Annexe A).',
    pevNoStartWarn:
      'PEV activé : renseignez l\'heure d\'ouverture du start (NoStart) si la compétition la publie.',
    maxStartSpeedWarn:
      'Vitesse sol max au départ : {{speed}} km/h (contrôle sur trace IGC).',
    legDepartureAirfield: 'Point {{index}} : le décollage doit être un aérodrome.',
    legArrivalAirfield: 'Point {{index}} : l\'atterrissage doit être un aérodrome.',
    legDepartureLine: 'Point {{index}} : ligne de départ requise.',
    legArrivalLine: 'Point {{index}} : ligne d\'arrivée requise.',
    legDepartureCylinder: 'Point {{index}} : cylindre de départ requis (pas une ligne).',
    legDepartureRadius: 'Point {{index}} : rayon départ ≥ {{km}} km.',
    faiCylinderWarn:
      'Cylindre de départ < {{km}} km : vérifiez la feuille de route.'
  },
  mapActions: {
    setDeparture: 'Définir décollage',
    setArrival: 'Définir atterrissage',
    onlyAirfieldDeparture: 'Seul un aérodrome peut être défini comme décollage.',
    onlyAirfieldArrival: 'Seul un aérodrome peut être défini comme atterrissage.',
    setDepartureDone: '« {{name}} » défini comme décollage',
    setArrivalDone: '« {{name}} » défini comme atterrissage',
    removeLast: '« {{name}} » retiré du circuit',
    removeAll: 'Toutes les occurrences de « {{name}} » retirées',
    waypointDeleted: 'Point « {{name}} » supprimé'
  }
} as const;
