import { fr } from './fr';

export const en = {
  app: {
    title: 'Glide Task Planner',
    tagline: 'Gliding task planning and export',
    nav: {
      circuit: 'Task',
      safetyProfile: 'Safety profile',
      airspaceDebug: 'Airspace lab',
      waypoints: 'Waypoints',
      dataSources: 'Data sources',
      library: 'Library',
      mainAria: 'Main navigation',
      menuTitle: 'Menu',
      openMenu: 'Open menu'
    },
    lang: {
      switch: 'Language',
      fr: 'FR',
      en: 'EN'
    },
    footer: 'Glide Task Planner'
  },
  airspaceFilters: {
    aria: 'Filter displayed airspace zones',
    title: 'Airspace filters',
    intro:
      'Types and names: click chips. Floor / ceiling: use sliders (MSL altitudes from loaded zones).',
    reset: 'Clear all',
    noData: 'Load airspace to see filter options.',
    tabZones: 'Zone types',
    tabVertical: 'Altitudes',
    altitudeIntro:
      'Only zones whose floor and ceiling (m MSL, after AGL/DEM) fall within the ranges below stay visible.',
    floorTitle: 'Zone floor',
    ceilingTitle: 'Zone ceiling',
    altitudeReset: 'Full range',
    floorIdle: 'Any floor — sliders at region maximum.',
    floorActive: 'Filter on: floor must be within the range.',
    ceilingIdle: 'Any ceiling — sliders at region maximum.',
    ceilingActive: 'Filter on: ceiling must be within the range.',
    noAltitude: 'No MSL altitude could be derived from loaded zones.',
    altitudeUnknown:
      '{{count}} zone(s) with unknown altitude — hidden when an altitude filter is active.',
    tabName: 'Name',
    selectAll: 'Select all',
    clear: 'Clear selection',
    searchPlaceholder: 'Search…',
    noMatch: 'No matching label.',
    sectionIdle: 'No selection — all zones for this criterion are shown.',
    sectionInclude: '{{count}} selected — map shows only these.',
    sectionExclude: '{{count}} selected — map hides these.',
    activeCount: '{{count}} active filter(s)',
    modeInclude: 'Keep selection',
    modeExclude: 'Hide selection',
    volume: 'Geometry',
    volumeAll: 'All',
    volumeVolumetric: '3D volumes only',
    volumeFlat: '2D outlines only',
    class: 'Class',
    type: 'Type',
    name: 'Name',
    namePlaceholder: 'Substring…',
    nameAdd: 'Add',
    nameRemove: 'Remove {{term}}',
    limitKind: {
      msl: 'MSL / FL',
      agl: 'AGL',
      ground: 'Ground / GND',
      unlimited: 'Unlimited',
      unknown: 'Other'
    }
  },
  common: {
    yes: 'Yes',
    no: 'No',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    confirm: 'Confirmation',
    loading: 'Loading…',
    all: 'All',
    done: 'Done',
    modify: 'Edit',
    remove: 'Remove',
    export: 'Export',
    import: 'Import',
    load: 'Load',
    preview: 'Preview',
    download: 'Download',
    filter: 'Filter…',
    choose: '— Select —',
    offTask: 'off task',
    compliant: 'Compliant with rules',
    reorder: 'Reorder',
    copy: 'Copy',
    copied: 'Copied',
    duplicate: 'Duplicate',
    rename: 'Rename',
    firstPage: 'First page',
    prevPage: 'Previous page',
    nextPage: 'Next page',
    lastPage: 'Last page',
    collapsePanel: 'Collapse',
    actions: 'Actions',
    searchLabel: 'Search',
    pts: '{{count}} pts',
    inTask: '{{count}} in task',
    noBase: 'No database',
    disclaimerData: 'Data disclaimer',
    basePrefix: 'Database:',
    code: 'Code',
    altShort: 'Alt.',
    added: '« {{name}} » added',
    updated: '« {{name}} » updated'
  },
  circuit: {
    title: 'Task',
    taskDistance: 'Task distance',
    total: 'Total',
    pointsMetric: 'Points',
    pointsCount: '{{count}} pt(s)',
    tabs: {
      map: 'Map',
      circuit: 'Task',
      circuitWithCount: 'Task ({{count}})',
      export: 'Export'
    },
    mapSummary: {
      title: 'Task summary',
      editCircuit: 'Edit task',
      empty: 'No points in the task — switch to the Task tab or double-click the map.',
      more: '+ {{count}} more point(s)'
    },
    sections: {
      points: 'Points',
      regulation: 'Rules',
      regulationWithErrors: 'Rules ({{count}})',
      export: 'Export',
      exportBlocked: 'Export · blocked'
    },
    points: {
      panelAria: 'Task waypoints',
      hint:
        'Take-off and landing at airfields (1<sup>st</sup> / last) · distance excludes departure/arrival legs',
      add: 'Add waypoints',
      addTooltip: 'Load a CUP database first',
      loading: 'Loading waypoints from database…',
      empty: 'No waypoints in the task — add some from the database or map.',
      zoneAltitude: 'Zone and altitude'
    },
    role: {
      departure: 'Take-off',
      arrival: 'Landing',
      turnpoint: 'Turn',
      turnpointLong: 'Turn point'
    },
    regulation: {
      panelAria: 'Rules',
      statusOk: 'Task complies with rules',
      statusWarn: '{{count}} warning(s)',
      statusError: '{{count}} compliance error(s)',
      errors: 'Errors',
      warnings: 'Warnings',
      legCheck: 'Task waypoints'
    },
    export: {
      panelAria: 'Export',
      fixRegulation: 'Fix rules',
      taskNamePlaceholder: 'Task_500K',
      myCircuits: 'My tasks',
      previewExport: 'Export preview',
      clearTask: 'Clear task',
      statusEmpty: 'Add waypoints to export',
      statusBlocked: 'Export blocked — rules not satisfied',
      statusReady: 'Ready to export · {{label}}',
      sectionTask: 'Task',
      taskNameLabel: 'Task name (NEWTASK)',
      sectionPilot: 'Pilot and glider',
      pilotEmpty: 'Not set — required for a complete FLARM export',
      sectionFormats: 'File formats',
      flarmHint: 'FLARM: restart the device after copying to SD/USB.',
      sectionLibrary: 'Library',
      taskMeta: '{{task}} km task',
      taskMetaTotal: ' · {{total}} km total',
      taskMetaPoints: ' · {{count}} waypoint(s)',
      formatFlarmDetail: 'flarmcfg.txt — SD/USB',
      formatCupDetail: 'Waypoints + task',
      formatCupxDetail: 'POINTS.CUP archive',
      formatTskDetail: '.tsk file',
      formatIgcDetail: 'Declared trace',
      profileApplied: 'Rules applied',
      chooseProfile: 'Choose rules',
      radiiTitle: 'Zone radii (m)',
      startCupTitle: 'Start and CUP options'
    },
    clearConfirm: 'Remove all waypoints from the task?',
    clearTaskHeader: 'Clear task',
    clearTaskAccept: 'Clear',
    exportFailed: 'Export failed',
    exportDone: 'File exported',
    exportDoneTitle: 'Export complete',
    circuitSaved: 'Task saved to library.',
    circuitUpdated: 'Task updated.',
    saveFailed: 'Could not save.',
    circuitLoaded: 'Task loaded — check pilot / glider then export FLARM.',
    waypointAddedTurn: '« {{name}} » added as turn point',
    panelsAria: 'Panels',
    circuitPanelAria: 'Task and export'
  },
  dataSources: {
    title: 'Data sources',
    intro:
      'Manage your turnpoint database (CUP) and airspace data for the map and safety profile. Each section works the same way: active source, import, then pick from the lists.',
    cup: {
      sectionTitle: 'Turnpoints (CUP)',
      statusAria: 'Active CUP database',
      statusSubtitle: 'Turnpoints',
      activeBadge: 'Active database',
      activeEmpty: 'No database loaded',
      activeEmptyHint: 'Import a .cup file or pick a source below.',
      loadedAt: 'Loaded on {{date}}',
      import: 'Import .cup',
      export: 'Export .cup',
      activate: 'Use',
      active: 'Active',
      integratedAria: 'Built-in turnpoint databases',
      integratedTitle: 'Built-in turnpoints',
      integratedHint:
        '.cup files in public/assets/cup/ (manifest generated at build). The first file in the folder (alphabetical order) loads by default on first visit.',
      integratedKind: 'Built-in .cup file',
      noIntegrated: 'No built-in database in configuration.',
      importedAria: 'Imported CUP files',
      importedTitle: 'Imported files',
      importedHint:
        '.cup files loaded from your device. Your choice is stored locally for reuse.',
      noImported: 'No imported files.',
      waypointCount: '{{count}} waypoints',
      removeImported: 'Remove import',
      removeImportedHeader: 'Remove file',
      removeImportedMessage:
        'Remove “{{label}}” from the list and delete the local copy? The in-memory database is unchanged if it is still active.',
      clearDb: 'Clear',
      clearDbHeader: 'Clear CUP database',
      clearDbMessage: 'Delete all waypoints and reset the task? This cannot be undone.',
      clearDbAccept: 'Clear',
      cleared: 'Database cleared.',
      urlAria: 'Load CUP from URL',
      urlTitle: 'Load from URL',
      urlPlaceholder: 'https://…/file.cup',
      urlLoad: 'Load'
    },
    airspace: {
      sectionTitle: 'Airspace',
      statusAria: 'Airspace data source',
      statusTitle: 'Airspace',
      activeBadge: 'Active source',
      activeEmpty: 'No source selected',
      builtinAria: 'POAFF regions',
      builtinTitle: 'POAFF regions (SIA)',
      builtinHint:
        'Open-data airspace cartography for free flight. Files are served locally or via the dev proxy.',
      customAria: 'Custom imports',
      customTitle: 'Imported files',
      customHint: 'GeoJSON FeatureCollection (.geojson, .json). Your choice is stored on this device.',
      noCustom: 'No imported files.',
      import: 'Import GeoJSON',
      importFailed: 'Could not read this file (expected GeoJSON FeatureCollection).',
      imported: 'Source imported',
      importedDetail: '{{count}} features — shown on the map when active.',
      activate: 'Use',
      active: 'Active',
      removeCustom: 'Remove import',
      removeCustomHeader: 'Remove source',
      removeCustomMessage:
        'Remove “{{label}}” from the list and delete the local file? Associated enrichment caches will be cleared.',
      featureCount: '{{count}} zones'
    }
  },
  cup: {
    sectionQuick: 'Known source',
    sectionUrl: 'From URL',
    sectionFile: 'Local file',
    panelAria: 'Waypoint database',
    changeSource: 'Change database',
    shortcutAria: 'Active CUP database',
    shortcutPoints: '· {{count}} pts',
    changeBase: 'Change database',
    actionsAria: 'Database actions',
    sourcePlaceholder: 'Known source…',
    urlPlaceholder: 'URL of .cup file',
    load: 'Load',
    importCup: 'Import .cup',
    exportCup: 'Export .cup',
    importConfirm: 'Importing « {{name}} » will replace current waypoints. Continue?',
    importHeader: 'Import CUP database',
    loaded: 'CUP database loaded',
    loadedDetail: '{{count}} waypoint(s)',
    replaceHeader: 'Replace database',
    replaceFileMessage: 'Importing « {{name}} » will replace current waypoints. Continue?',
    replaceUrlMessage: 'Loading this database will replace the current {{count}} waypoints. Continue?',
    configError: 'CUP sources configuration unavailable',
    noWaypoints: 'No waypoints found in file',
    loadFailed: 'Load failed',
    title: 'Waypoint database',
    noBase: 'No database'
  },
  waypoints: {
    title: 'Waypoint management',
    hint: 'To build a FLARM task, use the',
    declarationLink: 'Task',
    page: 'page',
    importCup: 'Import .cup',
    exportCup: 'Export .cup',
    clearAll: 'Clear all',
    add: 'Add',
    close: 'Close',
    formNew: 'New waypoint',
    formEdit: 'Edit waypoint',
    name: 'Name',
    type: 'Type',
    latitude: 'Latitude',
    longitude: 'Longitude',
    elevation: 'Elevation (m)',
    description: 'Description',
    count: '{{count}} waypoint(s)',
    results: '{{shown}} result(s) of {{total}}',
    searchPlaceholder: 'Search name, code, type, coordinates…',
    clearSearch: 'Clear search',
    pagerAria: 'Waypoint pagination',
    perPage: 'Per page',
    empty: 'No waypoints. Load a database on the Task page or add manually.',
    noSearch: 'No waypoint matches your search.',
    deleteConfirm: 'Delete this waypoint?',
    deleteHeader: 'Delete waypoint',
    deleted: 'Waypoint deleted',
    exportDone: 'CUP export downloaded',
    importHeader: 'Import CUP database',
    importConfirm: 'Importing « {{name}} » will replace current waypoints. Continue?',
    imported: 'CUP database imported',
    importError: 'Invalid or unreadable CUP file',
    clearHeader: 'Clear all waypoints',
    clearConfirm: 'Clear all waypoints? This cannot be undone.',
    clearAccept: 'Clear all',
    cleared: 'All waypoints cleared',
    sortBy: 'Sort by {{field}}',
    sortActive: 'Sorted by {{field}}, {{dir}}',
    sortAsc: 'ascending',
    sortDesc: 'descending',
    update: 'Update',
    sort: {
      name: 'name',
      type: 'type',
      latitude: 'latitude',
      longitude: 'longitude',
      elevation: 'elevation'
    }
  },
  picker: {
    title: 'Choose waypoints',
    search: 'Search name, code…',
    filtersAria: 'Filters',
    listAria: 'Page {{page}}',
    pagerAria: 'Point pagination',
    perPage: 'Per page',
    results: '{{count}} result(s)',
    empty: 'No matching waypoint.',
    prevPage: 'Previous page',
    nextPage: 'Next page',
    perPageAria: 'Waypoints per page'
  },
  map: {
    centerTask: 'Center on task',
    centerAll: 'Center all waypoints',
    clearSelection: 'Clear selection',
    region: 'Region',
    filtersAria: 'Waypoint types shown',
    helpTitle: 'Map help',
    helpTooltip:
      'Task zones: cylinders/sectors/lines in real meters · POAFF/OpenAIP airspace · terrain elevation on hover (Mapterhorn DEM) · task always visible (leg numbers) · catalog: clusters below zoom 10 · double-click: waypoint · click: menu',
    terrain: {
      cursorElevation: 'Terrain: {{value}}',
      attributionShort: 'DEM © Mapterhorn'
    },
    legendAria: 'Map legend',
    legendTask: 'Task',
    legendCatalog: 'Catalog',
    legendCluster: 'Catalog clusters (zoom < 10)',
    clearTaskHeader: 'Clear task',
    clearTaskMessage: 'Remove all waypoints from the task shown on the map?',
    deleteFromDbHeader: 'Delete waypoint',
    deleteFromDbMessage: 'Delete « {{name}} » from the database?',
    moreActions: 'More map actions',
    fabToolbarAria: 'Map actions',
    basemap: {
      title: 'Basemap',
      esriSatellite: 'Esri satellite',
      esriTopo: 'Esri topo',
      osm: 'OpenStreetMap',
      cartoVoyager: 'Carto Voyager',
      cartoLight: 'Carto Light',
      opentopo: 'OpenTopoMap (terrain)',
      mapterhornDemGray: 'Mapterhorn DEM (grayscale)'
    },
    mapLayersMenu: 'Map layers',
    showFullCatalog: 'Show full CUP',
    hideFullCatalog: 'Task only',
    showFullCatalogCount: 'Show full CUP ({{count}} pts)',
    filtersToggle: 'Types',
    filtersExpanded: 'Types ▴',
    filtersCollapsed: 'Types ▾',
    filtersTypesAria: 'Show waypoint types on the map',
    taskZones: 'Task zones',
    taskZonesTooltip: 'Cylinders / lines / sectors at real scale (m)',
    taskZonesTooltipEmpty: 'Build a task first',
    taskZonesAria: 'Show observation zones',
    airspace: 'Airspace',
    airspaceAria: 'Show airspace',
    airspaceVolume3d: '3D volumes (true scale)',
    airspaceVolume3dHint: 'Prisms from floor to ceiling (FL standard pressure, AGL + DEM ground)',
    airspaceLoading: 'Loading airspace…',
    airspacePoaffVolumes:
      'POAFF — {{label}} · {{count}} 3D volumes · {{shown}}/{{total}} zones',
    airspaceFiltersFab: 'Airspace filters',
    airspaceFiltersFabAria: 'Open airspace filters',
    mapNotReady: 'Map not ready — wait a moment and try again.',
    airspaceOpenAip: 'OpenAIP (worldwide)',
    airspacePoaff: 'POAFF/SIA — {{label}} (optional OpenAIP key in public/config/airspace.json)',
    showType: 'Show {{label}}',
    failNotFound:
      'POAFF files not found. In dev: restart with npm start (proxy). Otherwise: npm run airspace:fetch then reload.',
    failNetwork: 'Network unavailable or POAFF server unreachable. Try again later.',
    failParse: 'Invalid POAFF response (empty or corrupt GeoJSON).',
    failGeneric: 'Could not load airspace.',
    attribution:
      'Airspace © <a href="https://www.openaip.net">OpenAIP</a> (CC BY-NC 4.0)'
  },
  cupUrl: {
    rejected: 'CUP URL not allowed: {{url}}',
    defaultBase: 'AAPCA waypoints 11 June 2025',
    httpError: 'Could not load CUP (HTTP {{status}})',
    noBaseLabel: 'No database'
  },
  pilot: {
    title: 'Pilot & glider',
    name: 'Pilot name',
    namePlaceholder: 'John Smith',
    glider: 'Glider',
    gliderPlaceholder: 'JS1-C',
    reg: 'Registration',
    regPlaceholder: 'G-ABCD',
    compId: 'Competition ID',
    compIdPlaceholder: 'ZX',
    class: 'Class',
    classPlaceholder: 'Standard',
    pilotLabel: 'Pilot',
    gliderType: 'Glider type',
    logint: 'LOGINT (s)'
  },
  dialogs: {
    myCircuits: 'My tasks',
    exportPreview: 'Export preview',
    legZoneSave: 'Save',
    waypointEditSave: 'Save'
  },
  library: {
    pageTitle: 'Circuit library',
    pageIntro:
      'Save circuits locally, export as JSON, and reload them on this device. If waypoints are missing from your database, create them or load the matching CUP file.',
    goCircuit: 'Open task',
    statusAria: 'Library status',
    savedCount: '{{count}} saved circuit(s)',
    currentTaskReady: 'Current task: {{count}} waypoint(s)',
    currentTaskEmpty: 'No current task (at least 2 waypoints to save)',
    saveFailed: 'Could not save',
    resolveTitle: 'Missing waypoints',
    resolveIntro:
      'Circuit « {{name}} » includes waypoints not in your local database:',
    resolveCreate: 'Create missing waypoints',
    resolveLoadCup: 'Load saved CUP',
    resolveCupFile: 'Load a .cup file',
    resolveCupHint: 'A CUP file saved with this circuit may provide the missing waypoints.',
    resolveNoCupUrl: 'No CUP URL stored for this circuit — load a file or open data sources.',
    resolveGoSources: 'Data sources',
    resolveCancel: 'Cancel load',
    resolveAllMatched: 'All waypoints are now in the database.',
    resolveStillMissing: 'Some waypoints are still missing. Create them, load a CUP, or cancel.',
    namePlaceholder: 'Task name (e.g. 500 km Vinon)',
    notesPlaceholder: 'Notes (pilot, glider…)',
    deleteConfirm: 'Delete this saved task?',
    deleted: 'Task deleted',
    importMerge: 'Merge with existing saved tasks?',
    imported: '{{count}} task(s) imported',
    importError: 'Invalid JSON file',
    title: 'Saved tasks library',
    desc: 'Local storage with FLARM profile. Export JSON for another device or pilot.',
    quickLoad: 'Quick load',
    chooseCircuit: '— Select a saved task —',
    saveTitle: 'Save current task',
    saveTitleUpdate: 'Update',
    minPoints: 'At least 2 waypoints required in the task.',
    empty: 'No saved tasks — save the current task above.',
    emptyFilter: 'No results for this filter.',
    loaded: 'Task loaded.',
    exported: 'Library exported.',
    renamePrompt: 'New task name:',
    loadTitle: 'Load',
    ptsMeta: '{{count}} pts'
  },
  regulation: {
    panelAria: 'Task rules',
    choose: 'Choose rules',
    appliedLabel: 'Rules applied',
    radiiTitle: 'Zone radii (m)',
    startCupTitle: 'Start and CUP options',
    applyToPoints: 'Apply rules to waypoints',
    applyConfirm: 'Replace circuit zones and options with the selected rules?',
    applied: 'Rules applied',
    appliedDetail: 'Profile and zones updated.',
    zonesUpdated: 'Zones updated',
    zonesUpdatedDetail: 'Rule radii and presets applied.',
    taskTimePlaceholder: '12:30:00',
    changeProfileHeader: 'Change rules',
    changeProfileMessage:
      'Apply the profile default values (radii and zones) to all task waypoints?',
    applyProfileYes: 'Yes, apply',
    applyProfileNo: 'No, keep zones',
    scoringTooltip:
      'This app prepares declaration files. Official scoring (IGC trace, PEV on primary logger) remains with the scorer. FLARM: waypoints without zones.',
    startKind: {
      line: 'Line',
      cylinder: 'Cylinder'
    },
    accordionTitle: 'Rules settings',
    limitsAria: 'Limits and scoring',
    radiusDeparture: 'Start radius (m)',
    radiusTurn: 'Turn radius (m)',
    radiusArrival: 'Finish radius (m)',
    startType: 'Start type',
    noStartLabel: 'Start opening (NoStart, HH:MM:SS)',
    pevLabel: 'PEV (Annex A §7.4.3)',
    pevWait: 'PEV wait (min)',
    pevWindow: 'PEV window (min)',
    complianceRegulation: 'Rules: {{label}}',
    complianceRadii: 'Radii — start {{departure}} m · turn {{turn}} m · finish {{arrival}} m',
    complianceStartLine: 'Start: line',
    complianceStartCylinder: 'Start: cylinder',
    compliancePev: 'PEV — wait {{wait}} min, window {{window}} min',
    complianceScoringNote:
      'Official scoring (IGC trace, PEV on primary logger) remains with the scorer.',
    profiles: {
      club: {
        label: 'Club (free)',
        description:
          'Default start/finish lines, airfields recommended. Export allowed with warnings.'
      },
      seeyou_standard: {
        label: 'SeeYou standard',
        description:
          'Classic CUP options: WpDis=False, NearDis/NearAlt tolerances, start/finish lines.'
      },
      fai_line_pev: {
        label: 'FAI — Line + PEV',
        description:
          'Championship: mandatory airfields, start line, PEV 5–10 min (§7.4.3). ' +
          'Default radii — adjust to task sheet. NearDis = SeeYou tolerance, not IGC §7.6.5 rule.'
      },
      fai_cylinder_start: {
        label: 'FAI — Cylinder start',
        description:
          'Cylinder start >= 10 km (§7.4.4) — PEV inside cylinder is the standard procedure. ' +
          'Mandatory airfields. Default radii — adjust to task sheet.'
      },
      custom: {
        label: 'Custom',
        description: 'Adjustable radii, zones and constraints.'
      }
    }
  },
  zone: {
    line: 'Line {{meters}} m',
    lineKm: 'Line {{km}} km',
    sectorKm: 'Sector {{km}} km',
    sectorDeg: 'Sector {{deg}}° · {{meters}} m',
    cylSym: 'Cyl. sym. {{meters}} m',
    cyl: 'Cyl. {{meters}} m'
  },
  rules: {
    emptyCircuit: 'The task is empty.',
    requireDepartureAirfield: 'A take-off airfield is required for these rules.',
    requireArrivalAirfield: 'A landing airfield is required for these rules.',
    minTurnpoints: 'At least one turn point is required.',
    pevWaitRange: 'PEV Wait: {{min}}–{{max}} min (Annex A).',
    pevWindowRange: 'PEV Window: {{min}}–{{max}} min (Annex A).',
    pevNoStartWarn:
      'PEV enabled: set start opening time (NoStart) if the competition publishes it.',
    maxStartSpeedWarn:
      'Max ground speed at start: {{speed}} km/h (checked on IGC trace).',
    legDepartureAirfield: 'Point {{index}}: take-off must be an airfield.',
    legArrivalAirfield: 'Point {{index}}: landing must be an airfield.',
    legDepartureLine: 'Point {{index}}: start line required.',
    legArrivalLine: 'Point {{index}}: finish line required.',
    legDepartureCylinder: 'Point {{index}}: start cylinder required (not a line).',
    legDepartureRadius: 'Point {{index}}: start radius ≥ {{km}} km.',
    faiCylinderWarn:
      'Start cylinder < {{km}} km: check the task sheet.',
    legDepartureLineStyle: 'Point {{index}}: start line should be Style 2 (to next), not Style 3.',
    legArrivalLineStyle: 'Point {{index}}: finish line should be Style 3 (to previous), not Style 2.'
  },
  wpType: {
    turnpoint: { label: 'Turn points', description: 'Turn point', shortLabel: 'TP' },
    airfield: { label: 'Airfields', description: 'Airfield', shortLabel: 'AD' },
    landable: { label: 'Landable', description: 'Landable field', shortLabel: 'AL' },
    custom: { label: 'Custom', description: 'Custom point', shortLabel: 'P' }
  },
  zonePreset: {
    cylinder_fixed: { label: 'Fixed cylinder', description: 'Style 0 — cylinder oriented north (SeeYou)' },
    cylinder_symmetric: {
      label: 'Symmetric cylinder',
      description: 'Style 1 — oriented toward adjacent points'
    },
    start_line: { label: 'Start line', description: 'Style 2, Line=1 — R1 = half gate width (total length = 2 x R1)' },
    finish_line: { label: 'Finish line', description: 'Style 3, Line=1 — R1 = half gate width, oriented toward previous point' },
    departure_cylinder: { label: 'Start cylinder', description: 'Style 0 — cylinder without line (take-off)' },
    arrival_cylinder: { label: 'Finish cylinder', description: 'Style 0 — cylinder without line (landing)' },
    arrival_ring: { label: 'FAI finish ring', description: 'Style 0 — cylinder >= 3 km (Finish Ring §7.8.2 — preferred option in championships)' },
    start_cylinder_fai: { label: 'FAI start cylinder', description: 'Style 0 — cylinder >= 10 km (Cylinder Start §7.4.4)' },
    sector_to_next: {
      label: 'Sector to next',
      description: 'Style 2 — sector oriented toward next point'
    },
    sector_fai: { label: 'CUP keyhole (example)', description: 'Style 0 — keyhole with R2 (CUP spec §6.3 example values; adjust R1/A1/R2/A2/A12 to your task)' },
    custom: { label: 'Custom', description: 'Manual setup — only useful parameters shown' }
  },
  zoneCup: {
    style0: 'Fixed (0)',
    style1: 'Symmetric (1)',
    style2: 'To next point (2)',
    style3: 'To previous point (3)',
    style4: 'To start (4)',
    paramStyle: 'Style',
    paramR1: 'R1',
    paramA1: 'A1',
    paramR2: 'R2',
    paramA2: 'A2',
    paramA12: 'A12',
    paramLine: 'Line',
    editableParams: 'Editable parameters: {{params}}.',
    diagramAria: 'CUP parameters diagram',
    diagramTitle: 'CUP parameters diagram',
    diagramLead: 'Top-down view (north up). Parameters relevant to the current setup.',
    presetPickerAria: 'Observation zone types',
    presetPickerTitle: 'Choose a zone type',
    presetPickerLead:
      'Previews use current rules (radii) and circuit waypoint geometry — not the fields below.',
    zoneType: 'Zone type',
    cupStyle: 'CUP style',
    cupStylePickerAria: 'CUP orientation styles',
    cupStylePickerLead:
      'Zone orientation (blue arrow) — circuit references, not R1/A1 shape.',
    styleOrientation: {
      axis: 'Axis {{bearing}}°',
      ref0north: 'Fixed bearing · map north',
      ref0a12: 'Fixed bearing · A12 = {{a12}}°',
      ref1: 'Bisector · {{prev}} ↔ {{next}}',
      ref1missing: 'Symmetric · previous and next required',
      ref2: 'To next point · {{next}}',
      ref2missing: 'Next point missing',
      ref3: 'To previous point · {{prev}}',
      ref3missing: 'Previous point missing',
      ref4: 'To start · {{dep}}',
      ref4missing: 'Start missing on task'
    },
    lineCup: 'Line (CUP Line=1)',
    r1LineHint: 'Half gate width — total line length = {{total}} m.',
    r2LargerThanR1: 'R2 must be less than R1 (inner radius < outer radius).',
    a2LargerThanA1: 'A2 must be ≤ A1 (inner sector wider than outer sector).',
    ringTooSmall: 'Finish ring: radius < {{min}} km (FAI §7.8.2 minimum).',
    cylinderTooSmall: 'Start cylinder: radius < {{km}} km (FAI §7.4.4 minimum).',
    lineLockedHint: 'Line required by the active regulation.',
    styleDiscouraged: 'Unusual style for this point type — check export consistency.',
    a1LineHint: 'Line opening angle (often 180°).',
    a1SectorHint: 'Sector width (°) around the orientation axis.',
    r2Hint: 'Inner radius (hole / FAI keyhole).',
    a2Hint: 'Inner sector opening on R2 (same axis as A1).',
    a12Hint: 'Fixed style: bearing in CUP; sector axis on map ≈ A12 + 180°.',
    customElevation: 'Custom task elevation (MSL)',
    elevationMsl: 'Elevation (m MSL)',
    exportElevation: 'Export elevation: {{value}} (CUP waypoint)',
    header: 'Zone & altitude — {{name}}',
    pointMeta: 'Point {{index}} · {{role}}'
  },
  preview: {
    formatAria: 'Preview format',
    cupArchiveNote: '[POINTS.CUP content — .cupx file is a binary archive]',
    formatFlarm: 'FLARM (flarmcfg.txt)',
    formatCup: 'CUP with task',
    formatCupx: 'CUPX (POINTS.CUP)',
    formatTsk: 'XCSoar (.tsk)',
    formatIgc: 'IGC C-records'
  },
  mapPopup: {
    circuitPrefix: 'Task:',
    setTurnpoint: 'Set as turn point',
    removeLast: 'Remove last occurrence',
    removeFromCircuit: 'Remove from task',
    removeAll: 'Remove all occurrences',
    center: 'Center on map',
    deleteWaypoint: 'Delete this waypoint',
    menuAria: 'Actions for {{name}}'
  },
  validation: {
    singlePoint: 'Single point: declaration may be incomplete for some formats.',
    noCoursePoint: 'No course point (START, TURN or FINISH) in the declaration.',
    invalidCoords: 'Invalid coordinates for « {{name}} ».',
    missingFromCup: '« {{name}} » missing from loaded CUP database: CUP/CUPX export may fail in SeeYou.'
  },
  exportWarnings: {
    cupxNoPhotos: 'CUPX generated without photos (minimal pics.zip): database images are not included.'
  },
  waypointEdit: {
    createTitle: 'New waypoint',
    editTitle: 'Edit waypoint'
  },
  waypointsExtra: {
    emptyPage: 'No waypoints on this page.',
    perPageAria: 'Waypoints per page'
  },
  mapActions: {
    setDeparture: 'Set take-off',
    setArrival: 'Set landing',
    onlyAirfieldDeparture: 'Only an airfield can be set as take-off.',
    onlyAirfieldArrival: 'Only an airfield can be set as landing.',
    setDepartureDone: '« {{name}} » set as take-off',
    setArrivalDone: '« {{name}} » set as landing',
    removeLast: '« {{name}} » removed from task',
    removeAll: 'All occurrences of « {{name}} » removed',
    waypointDeleted: 'Waypoint « {{name}} » deleted'
  },
  airspaceDebug: {
    title: 'Airspace debug lab',
    intro:
      'Fictional zones near the Aravis to validate 2D rendering, 3D wireframe volumes, and MSL/AGL ceilings. Free camera (pitch up to 85°).',
    placement: 'Test placement',
    relocateToMapCenter: 'Move zones here (map center)',
    relocateHint:
      'Pan to the terrain you want, then click: the whole test grid is moved to the current map center and DEM is re-sampled.',
    gridAnchor: 'Grid anchor',
    display: 'Display',
    volume3d: '3D volumes (wireframe)',
    useDem: 'DEM terrain (else fixed 1800 m ground)',
    basemap: 'Basemap',
    camera: 'Camera',
    cameraOblique: 'Oblique',
    cameraSide: 'Side',
    cameraTop: 'Top-down',
    cameraLow: 'Low angle',
    pitch: 'Pitch',
    bearing: 'Bearing',
    zoom: 'Zoom',
    scenariosTitle: 'Test scenarios',
    showAll: 'Show all',
    status: '{{volumes}} volume(s), {{wireframes}} wireframe(s) — {{total}} zone(s)',
    category: {
      msl: 'MSL',
      fl: 'Flight level',
      agl: 'AGL / ground',
      terrain: 'Terrain',
      flat: '2D only',
      excluded: 'No 3D wire',
      edge: 'Edge case'
    },
    scenarios: {
      mslFlBox: {
        title: 'CTR FL100 → FL200',
        desc: 'Constant MSL floor and ceiling (no terrain follow).',
        expected: 'Purple prism: base ~FL100, top ~FL200, flat roof visible.'
      },
      sfcFl999: {
        title: 'SFC → FL999',
        desc: 'POAFF “unlimited” ceiling (~30.5 km MSL).',
        expected: 'Very tall orange volume; floor on terrain if DEM on.'
      },
      fl999BadUpperM: {
        title: 'FL999 + wrong upperM (999)',
        desc: 'Ensures FL999 text wins over upperM=999 m.',
        expected: 'Same height as SFC→FL999, not a 999 m box.'
      },
      aglGndTop: {
        title: 'GND → 2500FT AGL',
        desc: 'AGL ceiling follows terrain per vertex.',
        expected: 'Sloped top with terrain; floor on DEM ground.'
      },
      ftAmsl: {
        title: '3000FT AMSL → 4500FT AMSL',
        desc: 'Feet AMSL (not flight level).',
        expected: 'Blue prism between ~914 m and ~1372 m MSL.'
      },
      mslMeters: {
        title: '2000M → 3500M',
        desc: 'Explicit MSL limits in metres.',
        expected: 'Red prism between 2000 and 3500 m MSL.'
      },
      unlimited: {
        title: 'SFC → UNLIMITED',
        desc: 'Display cap (~20 km).',
        expected: 'Tall purple volume; internal cap ~20,000 m.'
      },
      geoLocal: {
        title: 'GEO (small area)',
        desc: 'GEO / AREA type — excluded from wireframe.',
        expected: 'No 3D wireframe; clickable hit area only in volume mode.'
      },
      flatOutline: {
        title: '2D outline only',
        desc: 'No usable vertical limits.',
        expected: 'Boundary lines only (no prism).'
      },
      largeArea: {
        title: 'Large AREA (> 350 km)',
        desc: 'Simulated national extent — no 3D wireframe.',
        expected: 'No wireframe; fit bounds to whole France.'
      }
    }
  },
  safetyProfile: {
    title: 'Task safety profile',
    paramsTitle: 'Safety parameters',
    paramsShort: 'Settings',
    openParams: 'Open parameters and legend',
    closeParams: 'Close parameters panel',
    backToCircuit: 'Back to task',
    goToCircuit: 'Build a task',
    resetDefaults: 'Reset defaults',
    empty:
      'No task is built yet. Add at least a take-off and a landing to display the cross-sections.',
    cones3d: '3D cones on map',
    cones3dHint:
      'Shows half-ratio glide volumes from each enabled landable and the combined min envelope (red). Tilt the map for a better view.',
    airspaceZonesTitle: 'Zones in evolution perimeter',
    airspaceZonesHint:
      'Filtered by enabled location cones (horizontal and vertical). Hover for map preview.',
    airspaceZonesEnableAll: 'Show all',
    airspaceZonesDisableAll: 'Hide all',
    airspaceVolume3d: '3D volumes (true scale)',
    airspaceVolume3dHint:
      'Prisms from floor to ceiling; AGL/GND uses DEM ground under the polygon',
    lookPadAria:
      'Look control: hold left mouse button and drag',
    lookPadHint:
      'Hold left button: left/right = bearing, up/down = tilt, around the camera position.',
    altPadAria:
      'Altitude control: hold left mouse button and drag',
    altPadHint:
      'Hold left button: drag up to climb, down to descend (camera altitude only, view direction unchanged).',
    mapHint:
      'Map: 3D cones (cube), profile points (blue leg ends, colored landables), orange leg = selected. Hover the profile for the red cursor.',
    mapAria: 'Task map and leg selection',
    legTabsAria: 'Select leg to display',
    profilePanelAria: 'Vertical cross-section of the selected leg',
    profileSidebarAria: 'Landables and vertical scale for this leg',
    profileResizeHandle: 'Resize cross-section height',
    profileShrink: 'Shrink cross-section (more map space)',
    profileExpand: 'Enlarge cross-section',
    prevLeg: 'Previous leg',
    nextLeg: 'Next leg',
    verticalScaleMax: 'Max altitude (scale)',
    verticalScaleDefault: 'Default: {{value}} m (next 1000 m above max terrain)',
    verticalScaleReset: 'Reset scale',
    landablesToggleTitle: 'Landables on this leg',
    landablesEnableAll: 'Enable all',
    landablesDisableUseless: 'Disable non-binding',
    landablesDisableUselessHint:
      'Disables landables whose half-ratio cone never limits the minimum altitude (red line).',
    landablesDisableAll: 'Disable all',
    landableTypeAirfield: 'AD',
    legHeader: 'Leg {{index}}',
    params: {
      sectionCalculation: 'Envelope calculation',
      sectionLegend: 'Cross-section legend',
      glideRatio: 'Glider glide ratio',
      glideRatioHint:
        '1 m of altitude lost = N m of distance. Safety cones use half the glide ratio (N ÷ 2).',
      arrivalMargin: 'Pattern altitude',
      arrivalMarginHint: 'Required height above the landable airfield.',
      groundMargin: 'Ground / ridge margin',
      groundMarginHint: 'Minimum clearance above terrain (passes, ridges).'
    },
    chart: {
      terrain: 'Terrain (DEM)',
      groundClearance: 'Terrain + margin',
      glideCone: 'Glide cone (landable color)',
      safety: 'Combined min altitude (all landables)',
      landableColors: 'One color per landable (map, cone, rings, chart)',
      landableConeBelowMin: 'Dashed cone below min altitude',
      coneIntersectionAltitude: 'Altitude at cone intersections',
      distanceAxis: 'Distance (km)',
      altitudeAxis: 'Altitude (m MSL)',
      tooltipDistance: 'Distance',
      tooltipTerrain: 'Terrain',
      tooltipCone: 'Min cone',
      tooltipGround: 'Terrain + margin',
      tooltipSafety: 'Min altitude',
      tooltipLandablesTitle: 'Reachable fields at this position',
      tooltipLandableAt: 'min',
      conesTruncated:
        'Display limited: cones whose glide volume reaches the leg segment (max 64, sorted by relevance). Bases may lie before or after the leg.',
      terrainMissing: 'DEM missing',
      terrainEstimated: 'Estimated terrain',
      legendTerrainMissing: 'No DEM elevation',
      legendTerrainEstimated: 'Altitude interpolated from endpoints',
      terrainLowFidelity: 'Low-fidelity DEM',
      legendTerrainLowFidelity:
        'Missing tile at z15 — terrain read from a lower-zoom tile',
      tooltipTerrainMissing: 'Terrain altitude: DEM unavailable',
      tooltipTerrainEstimated: 'Terrain altitude: estimated (endpoints)',
      tooltipTerrainLowFidelity:
        'Terrain altitude: low-fidelity DEM (lower-zoom tile)'
    },
    demProgress: {
      title: 'Loading terrain (DEM)',
      computeTitle: 'Computing safety envelopes',
      leg: 'Leg {{current}} / {{total}}',
      chunk: 'DEM window {{current}} / {{total}}',
      percent: '{{value}} %',
      legBarDem: 'Leg {{leg}}: loading terrain {{percent}}%',
      legBarCompute: 'Leg {{leg}}: computing envelope',
      legBarDone: 'Leg {{leg}}: done'
    },
    warnings: {
      noLandables:
        'No safe landable (airfield / outlanding) in the CUP database: the glide cone is not computed. Load a CUP database to enable this safety helper.',
      terrainGaps:
        'Incomplete terrain on this leg: some DEM tiles could not be loaded.',
      terrainGapsRetry: 'Retry terrain load'
    }
  }
} as unknown as typeof fr;
