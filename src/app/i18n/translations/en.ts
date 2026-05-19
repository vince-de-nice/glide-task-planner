import { fr } from './fr';

export const en = {
  app: {
    title: 'Glide Task Planner',
    tagline: 'Gliding task planning and export',
    nav: {
      circuit: 'Task',
      waypoints: 'Waypoints',
      mainAria: 'Main navigation'
    },
    lang: {
      switch: 'Language',
      fr: 'FR',
      en: 'EN'
    },
    footer: 'Glide Task Planner'
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
    reorder: 'Reorder'
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
      circuitWithCount: 'Task ({{count}})'
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
      turnpoint: 'Turn'
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
  cup: {
    panelAria: 'Waypoint database',
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
    loadFailed: 'Load failed'
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
    empty: 'No matching waypoint.'
  },
  map: {
    centerTask: 'Center on task',
    centerAll: 'Center all waypoints',
    clearSelection: 'Clear selection',
    region: 'Region',
    filtersAria: 'Map layers',
    helpTitle: 'Map help',
    helpTooltip:
      'Task zones: cylinders/sectors/lines in real meters · POAFF/OpenAIP airspace · names at zoom ≥ 11 · double-click: waypoint · click: menu',
    clearTaskHeader: 'Clear task',
    clearTaskMessage: 'Remove all waypoints from the task shown on the map?',
    deleteFromDbHeader: 'Delete waypoint',
    deleteFromDbMessage: 'Delete « {{name}} » from the database?'
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
    classPlaceholder: 'Standard'
  },
  dialogs: {
    myCircuits: 'My tasks',
    exportPreview: 'Export preview',
    legZoneSave: 'Save',
    waypointEditSave: 'Save'
  },
  library: {
    namePlaceholder: 'Task name (e.g. 500 km Vinon)',
    notesPlaceholder: 'Notes (pilot, glider…)',
    deleteConfirm: 'Delete this saved task?',
    deleted: 'Task deleted',
    importMerge: 'Merge with existing saved tasks?',
    imported: '{{count}} task(s) imported',
    importError: 'Invalid JSON file'
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
          'Championship: mandatory airfields, start line, PEV 5–10 min (Annex A §7.4.3).'
      },
      fai_cylinder_start: {
        label: 'FAI — Cylinder start',
        description:
          'Cylinder start ≥ 10 km (Annex A §7.4.4), PEV optional, mandatory airfields.'
      },
      custom: {
        label: 'Custom',
        description: 'Adjustable radii, zones and constraints.'
      }
    }
  },
  zone: {
    line: 'Line {{meters}} m',
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
      'Start cylinder < {{km}} km: check the task sheet.'
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
  }
} as unknown as typeof fr;
