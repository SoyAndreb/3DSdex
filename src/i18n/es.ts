import type { Dict } from './en';

/**
 * Spanish. Mirrors `en.ts` key for key - TypeScript fails the build if a key
 * is missing or a function signature drifts, so a translation can never be
 * silently incomplete.
 */
export const es: Dict = {
  app: {
    tabs: {
      library: 'CFW y Arranque',
      covers: 'Carátulas',
      stats: 'Pico Enhanced',
      associations: 'Asociaciones',
      screenshots: 'Capturas Luma',
      health: 'Salud y Auditoría',
    },
    sections: 'Secciones',
    openSdFolder: 'La tarjeta SD o carpeta local que tienes abierta',
    reload: 'Recargar',
    reloading: 'Recargando…',
    whatsNew: 'Novedades',
    footerLicense: 'Código abierto (MIT) · sin rastreo',
    language: 'Idioma',
    repoCard: (slug: string) => `${slug} en GitHub`,
    repoCardStats: (slug: string, stars: string, forks: string) =>
      `${slug} en GitHub. Estrellas: ${stars}. Forks: ${forks}.`,
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    themeSystem: 'Sistema',
    themeButton: (current: string, next: string) =>
      `Tema: ${current}. Pulsa para cambiar a ${next}.`,
  },
  welcome: {
    tagline:
      'Audita, organiza y actualiza la tarjeta SD de tu Nintendo 3DS o una carpeta local de trabajo/respaldo desde el navegador. Tus archivos nunca salen de tu equipo.',
    openSd: 'Abrir tarjeta SD o carpeta local',
    opening: 'Abriendo…',
    openLast: (name: string) => `Abrir ${name}`,
    lastCardReady: 'La tarjeta SD o carpeta que tenías abierta la última vez.',
    lastCardAskAgain:
      'La tarjeta SD o carpeta que tenías abierta la última vez. Tu navegador volverá a pedir acceso.',
    pickDifferent: 'Elegir otra SD o carpeta',
    unsupported:
      'Tu navegador no permite escritura directa en carpetas — 3DSdex abrirá tu tarjeta SD o carpeta local en Modo Compatible (Firefox) para que puedas exportar los cambios en un .zip.',
    waitingForFolder: 'Esperando la carpeta…',
    whatsNewButton: 'Novedades de 3DSdex',
    features: {
      boxArtTitle: 'Respaldo seguro',
      boxArtBody:
        'Respalda boot.firm, boot.3dsx y payloads antes de sobrescribir archivos críticos.',
      libraryTitle: 'Auditoría de SD',
      libraryBody:
        'Detecta basura del sistema, archivos .cia/.3dsx sueltos y componentes CFW faltantes.',
      statsTitle: 'Control de versiones',
      statsBody: 'Comprueba Luma3DS, GodMode9 y Homebrew Launcher frente a las últimas versiones.',
      healthTitle: 'Detección FBI / NSA',
      healthBody: 'Detecta carpetas de FBI y recomienda instalar NSA moderno si aún no lo tienes.',
      bannersTitle: 'Carpeta de trabajo',
      bannersBody:
        'Prueba limpiezas y organización en una copia local de respaldo antes de pasarla a tu 3DS.',
      associationsTitle: 'Compatible con Firefox',
      associationsBody:
        'Funciona sin File System Access API exportando un .zip listo para extraer en tu SD.',
    },
  },
  sd: {
    scanningLibrary: 'Escaneando tarjeta SD 3DS…',
    scanningLibraryCount: (count: number) => `Escaneando tarjeta SD 3DS… ${count} archivos`,
    readingCovers: 'Leyendo carátulas…',
    readingLauncherData: 'Inspeccionando estructura CFW 3DS…',
    waitingAccess: 'Esperando acceso a la carpeta…',
    needsAccess: (name: string) =>
      `3DSdex necesita tu permiso para abrir ${name}. Pulsa de nuevo Abrir ${name} y permite el acceso cuando el navegador te lo pida.`,
    noPicoAnymore:
      '3DSdex ya no encuentra esa carpeta. Conecta tu tarjeta SD o vuelve a elegir tu carpeta local.',
    noPicoPickRoot: '3DSdex no pudo reconocer una tarjeta SD de 3DS o carpeta de respaldo ahí.',
    noPicoOnCard: '3DSdex no pudo guardar el cambio porque la carpeta ya no es accesible.',
    not3dsAnymore:
      '3DSdex ya no reconoce una tarjeta SD de 3DS ni una carpeta de respaldo ahí. Vuelve a conectarla y pulsa Recargar.',
    not3dsPickRoot:
      '3DSdex no encontró archivos o carpetas estándar de 3DS (como boot.firm, luma/ o Nintendo 3DS/) ahí. Elige la raíz de tu tarjeta SD o carpeta local de respaldo.',
    fsDenied:
      'Tu equipo no dejó que PicoDex usara un archivo o carpeta de la tarjeta. Normalmente significa que la tarjeta está bloqueada o en solo lectura. Revisa el interruptor de bloqueo del lateral de la tarjeta SD o de su adaptador, desbloquéala si hace falta, vuelve a conectar la tarjeta y pulsa Recargar.',
    fsNotFound:
      'PicoDex ya no encuentra la tarjeta o un archivo de ella. Comprueba que la tarjeta sigue conectada y pulsa Recargar.',
  },
  errors: {
    rateLimited:
      'GitHub está limitando las búsquedas de carátulas por ahora. Vuelve a intentarlo dentro de una hora.',
    rateLimitedUntil: (time: string) =>
      `GitHub está limitando las búsquedas de carátulas hasta las ${time}. Vuelve a intentarlo después.`,
    catalogFailed: (status: number) =>
      `GitHub no pudo enviar la lista de carátulas (error ${status}). Vuelve a intentarlo en unos minutos.`,
    catalogUnreadable:
      'La respuesta de GitHub no traía la lista de carátulas. Vuelve a intentarlo en unos minutos.',
    imageDownloadFailed: (status: number): string =>
      status === 404
        ? 'Esta carátula ya no está disponible.'
        : `No se pudo descargar la carátula (error ${status}). Vuelve a intentarlo en unos minutos.`,
    imageUnreadable: 'PicoDex no puede leer esta imagen.',
    canvasFailed:
      'Tu navegador no pudo dibujar la imagen. Recarga la página y vuelve a intentarlo.',
    offline:
      'PicoDex no pudo conectar con GitHub. Revisa tu conexión a internet y vuelve a intentarlo.',
  },
  associations: {
    title: 'Asociaciones de archivos',
    openCard: 'Abre una tarjeta SD para editar las asociaciones.',
    noSettings1: 'No se encontró ',
    noSettings2: ' — arranca Pico Launcher una vez en tu flashcart para que cree ',
    noSettings3: ' y pulsa Recargar.',
    settingsInvalid1: 'PicoDex encontró ',
    settingsInvalid2:
      ' pero no puede leerlo: no es un archivo de ajustes válido. No arranques Pico Launcher hasta arreglarlo: si el launcher tampoco puede leerlo, lo sustituye por uno de fábrica y perderías tus asociaciones de archivos. Ábrelo en un editor de texto y busca una coma, comilla o llave que falte cerca del punto de abajo, o vuelve a poner una copia que tengas guardada. Después, pulsa Recargar.',
    settingsBom1: 'PicoDex encontró ',
    settingsBom2:
      ', pero empieza con una marca de orden de bytes (BOM), una marca invisible que algunos editores añaden al guardar. El launcher no puede leer un archivo que empiece así y lo sustituiría por uno de fábrica, y perderías tus asociaciones de archivos. No arranques Pico Launcher todavía: abre el archivo en un editor de texto, guárdalo como UTF-8 sin BOM y pulsa Recargar.',
    settingsNotObject1: 'PicoDex encontró ',
    settingsNotObject2:
      ', pero no contiene ajustes: su contenido no es un objeto JSON, así que no hay asociaciones de archivos que mostrar. Sustituye su contenido por {} o borra el archivo, y pulsa Recargar.',
    settingsUnreadable1: 'PicoDex encontró ',
    settingsUnreadable2:
      ' pero no pudo abrirlo. Puede que otro programa lo esté usando o que la tarjeta tenga algún problema. No arranques Pico Launcher hasta que PicoDex pueda abrirlo: si el launcher tampoco puede leerlo, lo sustituye por uno de fábrica y perderías tus asociaciones de archivos. Cierra los programas que estén usando la tarjeta y pulsa Recargar.',
    settingsDetail: 'Detalles: ',
    notRead:
      'PicoDex no pudo terminar de leer esta tarjeta, así que no sabe si settings.json está. Resuelve el problema que aparece arriba y pulsa Recargar.',
    intro1: 'Elige qué aplicación abre el launcher para cada extensión de archivo. Se guarda en ',
    intro2: '.',
    emptyList: 'Aún no hay asociaciones — añade una abajo.',
    extension: 'Extensión',
    appPath: 'Ruta de la aplicación',
    actions: 'Acciones',
    pathFor: (ext: string) => `Ruta de la aplicación para archivos .${ext}`,
    removeFor: (ext: string) => `Quitar la asociación .${ext}`,
    remove: 'Quitar',
    add: 'Añadir',
    invalidExt: 'Escribe las letras de la extensión, por ejemplo nes.',
    hint: 'Escribe la extensión sin el punto. Rutas de emuladores comunes: ',
    picoMissing:
      'No se guardó nada: PicoDex ya no encuentra la carpeta /_pico en la tarjeta. Comprueba que la tarjeta sigue conectada, pulsa Recargar y vuelve a guardar.',
    restartWarning:
      'Cuando guardes, los cambios se aplicarán la próxima vez que Pico Launcher arranque en tu DS.',
    emptyPaths:
      'Las rutas de aplicación no pueden estar vacías. Rellena o quita las filas en blanco.',
    discard: 'Descartar cambios',
    saveToSd: 'Guardar en la SD',
    saving: 'Guardando…',
  },
  statsEditor: {
    dialogLabel: (game: string) => `Editar estadísticas de ${game}`,
    title: (game: string) => `Editar estadísticas — ${game}`,
    close: 'Cerrar',
    launches: 'Partidas',
    playTime: 'Tiempo de juego',
    hours: 'Horas',
    minutes: 'Minutos',
    cancel: 'Cancelar',
    save: 'Guardar',
    saving: 'Guardando…',
  },
  changelog: {
    dialogLabel: 'Novedades de PicoDex',
    title: 'Novedades',
    close: 'Cerrar',
    fullNotes: 'Notas completas en GitHub',
  },
  dropImport: {
    queued: 'En cola',
    copying: 'Copiando…',
    added: 'Añadida',
    addedCover: 'Añadida, carátula descargada',
    addedNoCover: 'Añadida, no se encontró carátula',
    duplicate: 'Omitida (ya está en la tarjeta o repetida)',
    skipped: 'Omitida (ya está en la tarjeta)',
    unknownType: 'Omitida (no es un archivo de ROM compatible)',
    failed: 'Falló',
    failedWith: (message: string) => `Falló (${message})`,
    gamesDirError: 'No se pudo abrir la carpeta Games de la tarjeta',
    overlayBusy: 'Importación en curso…',
    overlayDrop: 'Suelta ROMs para añadirlas a tu tarjeta',
    resultsLabel: 'Resultados de la importación de ROMs',
    importing: 'Importando ROMs…',
    finished: 'Importación terminada',
    addedCount: (count: number) => (count === 1 ? '1 añadida' : `${String(count)} añadidas`),
    dismissLabel: 'Cerrar los resultados de la importación',
    busyTitle: 'Importación en curso',
    dismiss: 'Cerrar',
  },
  stats: {
    duration: (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
    favorite: 'Favorito',
    noStatsTitle: 'Aún no hay estadísticas de juego',
    noStatsBody:
      'registra el número de partidas, el tiempo de juego y si cada juego es favorito. Lanza algo desde el launcher y aparecerá aquí.',
    gamesPlayed: 'Títulos jugados',
    favorites: 'Favoritos',
    completed: 'Completados',
    totalLaunches: 'Partidas totales',
    totalPlayTime: 'Tiempo de juego total',
    mostPlayed: 'Más jugados',
    recentlyPlayed: 'Jugados recientemente',
    game: 'Juego',
    launches: 'Partidas',
    playTime: 'Tiempo de juego',
    noneLaunched: 'Aún no se ha lanzado ningún juego.',
    noFavorites: 'Aún no hay favoritos — pulsa X sobre un juego en el launcher para añadir uno.',
  },
  covers: {
    regionLabel: 'Carátulas',
    title: 'Carátulas',
    openCard: 'Abre una tarjeta SD para gestionar las carátulas.',
    intro:
      'Encuentra los juegos de tu tarjeta sin carátula y les baja una de libretro-thumbnails. Las carátulas se guardan directamente en tu tarjeta, listas para el launcher.',
    scanFailed: (message: string) => `Falló el escaneo: ${message}`,
    scanning: (done: number, total: number) => `Escaneando ${done}/${total}…`,
    fetchResults: 'Resultados de la descarga',
    fetchingCounter: (done: number, total: number) => `Bajando carátulas — ${done}/${total} listas`,
    batchFinished: (written: number, noMatch: number, failed: number) =>
      `Listo: ${written} guardadas · ${noMatch} sin encontrar · ${failed} fallidas`,
    writtenCoverAlt: (fileName: string) => `Carátula escrita para ${fileName}`,
    jobStatus: {
      pending: 'En cola',
      matched: 'Descargando…',
      written: 'Escrita',
      'no-match': 'Sin coincidencia',
      error: 'Falló',
    },
    viaBannerTitle: 'encontrada por el nombre que lleva el propio juego',
    noBoxartFound:
      'No se encontró carátula. Puedes elegir una a mano con el lápiz de la carátula del juego en Biblioteca.',
    unknownError: 'Error desconocido',
    catalogUnavailable:
      'No se pudo bajar la lista de carátulas. Revisa tu conexión a internet y vuelve a intentarlo.',
    coversDirFailed:
      'No se pudo abrir la carpeta _pico/covers de tu tarjeta. Comprueba que la tarjeta sigue conectada y vuelve a intentarlo.',
    noGames: 'No se encontraron juegos en esta tarjeta SD.',
    allCovered: (count: number) =>
      count === 1 ? 'Tu juego ya tiene carátula.' : `Los ${count} juegos ya tienen carátula.`,
    missingRegionLabel: 'Juegos sin carátula',
    missingTitle: 'Carátulas que faltan',
    selectAll: 'Seleccionar todos',
    selectNone: 'Deseleccionar todos',
    fetching: 'Bajando…',
    fetchCount: (count: number) => (count === 1 ? 'Bajar 1 carátula' : `Bajar ${count} carátulas`),
    noGamecode:
      'sin código de juego, así que la carátula va por el nombre del archivo (si lo renombras, se pierde)',
  },
  coverPicker: {
    dialogLabel: (game: string) => `Cambiar la carátula de ${game}`,
    title: (game: string) => `Cambiar carátula — ${game}`,
    close: 'Cerrar',
    searchPlaceholder: (system: string) => `Buscar carátulas de ${system}…`,
    searchLabel: 'Buscar carátulas',
    ownImageHint:
      'Vale cualquier PNG o JPG. Se estira para llenar la carátula, igual que las carátulas descargadas.',
    catalogFailed: (message: string) =>
      `No se pudo bajar la lista de carátulas. Puedes pulsar Reintentar o usar una imagen de tu equipo en la pestaña siguiente. Detalle: ${message}`,
    retry: 'Reintentar',
    loadingCatalog: 'Cargando el catálogo de carátulas…',
    noMatches: (query: string) => `No hay carátulas que coincidan con «${query}».`,
    current: 'Actual',
    currentAlt: (game: string) => `Carátula actual de ${game}`,
    newCover: 'Nueva',
    composingPreview: 'Componiendo la vista previa…',
    newAlt: (game: string) => `Vista previa de la nueva carátula de ${game}`,
    previewFailed: (message: string) =>
      `No se pudo preparar esta imagen. Vuelve a intentarlo o elige otra. Detalle: ${message}`,
    writeFailed: (message: string) => `No se pudo guardar en la tarjeta. ${message}`,
    // Va antes de una ruta en <code>; el JSX añade el espacio y la ruta.
    writes: 'Se guarda en',
    writing: 'Escribiendo…',
    coversDirMissing: 'No se pudo abrir la carpeta _pico/covers de tu tarjeta.',
    iconHint:
      'La imagen pequeña junto al nombre del juego en la lista del launcher. Los juegos de DS suelen traer la suya, y esta la sustituye. Los demás sistemas no traen ninguna, así que esta la añade. Tu imagen se ajusta a 32×32 sin deformarse, y las partes transparentes siguen transparentes.',
    iconNone: 'Sin icono personalizado',
    iconNeedsNewer:
      'Los iconos propios necesitan un Pico Launcher más nuevo que la v1.3.0. Con la versión v1.3.0 el icono se guarda en la tarjeta, pero la consola sigue mostrando el del juego.',
    iconInvalidOnCard:
      'El fichero de icono de la tarjeta no está en el formato que lee el launcher, así que la consola muestra un icono en blanco. Al guardar uno nuevo se reemplaza.',
    iconBannerNote:
      'Este juego tiene su propio archivo de banner en _pico/banners, y el launcher toma el icono de ahí. Un icono guardado aquí no se vería. Para usar tu propio icono, saca antes ese archivo de banner de _pico/banners.',
    iconCurrentAlt: (game: string) => `Icono actual de ${game}`,
    iconNewAlt: (game: string) => `Vista previa del nuevo icono de ${game}`,
    iconsDirMissing: 'No se pudo abrir la carpeta _pico/icons de tu tarjeta.',
    tabBoxArt: 'Carátulas',
    tabCoverFile: 'Carátula de tu equipo',
    tabIconFile: 'Icono de tu equipo',
    topScreen: 'Pantalla superior',
    bottomScreen: 'Pantalla inferior',
    save: 'Guardar',
    nothingToSave: 'Elige antes una carátula o un icono',
    builtInIconAlt: (game: string) => `Icono que trae ${game}`,
    bannerIconAlt: (game: string) => `Icono del banner de ${game}`,
  },
  library: {
    overviewLabel: 'Resumen de la biblioteca',
    games: 'Juegos',
    systems: 'Sistemas',
    favorites: 'Favoritos',
    playTime: 'Tiempo de juego',
    playTimeValue: (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours)}h ${String(minutes)}m`;
    },
    noGames1: 'No hay juegos en la tarjeta. PicoDex busca en todas las carpetas menos ',
    noGames2: ', así que tus juegos pueden estar en ',
    noGames3: ', en una carpeta ',
    noGames4: ' o en cualquier otro sitio. Copia tus juegos a la tarjeta y pulsa Recargar.',
    gameCount: (count: number) => (count === 1 ? '1 juego' : `${String(count)} juegos`),
    covers: (covered: number, count: number, approximate: boolean) =>
      `${String(covered)}/${String(count)} carátulas${approximate ? ' (aprox.)' : ''}`,
    approxTitle: (systemLabel: string) =>
      `Estimación. En ${systemLabel}, PicoDex cuenta los archivos de carátula de tu tarjeta en vez de comprobar cada juego, así que puede no ser exacto. La pestaña Carátulas muestra exactamente qué juegos no tienen carátula.`,
    viewGames: 'Ver juegos →',
    editBannerFor: (systemLabel: string) => `Editar el banner de la carpeta de ${systemLabel}`,
    editBannerTitle: (systemLabel: string) =>
      `Editar el banner de la carpeta ${systemLabel} (icono y nombre que muestra el launcher)`,
    cardComponentsLabel: 'Componentes de la tarjeta',
    onThisCard: 'En esta tarjeta',
    launcher: 'Launcher',
    picoLoader: 'Pico Loader',
    notFound: 'No encontrado',
    enhancedChip: 'Pico Enhanced',
    updatedOn: (date: string) => `· actualizado el ${date}`,
    apiVersion: (version: number) => `Instalado (API v${String(version)})`,
    capabilities: {
      gameLoading: 'Carga de juegos',
      returnToLauncher: 'Volver al launcher',
      cheats: 'Cheats',
    },
  },
  compat: {
    dialogLabel: (title: string) => `Compatibilidad del loader para ${title}`,
    kicker: 'Compatibilidad del loader',
    close: 'Cerrar',
    noHeader:
      'PicoDex no pudo leer este archivo de juego, así que no puede mostrar qué hace el loader con él. Puede que esté dañado o a medio copiar: prueba a copiarlo otra vez a la tarjeta.',
    noGameCode:
      'Este archivo de juego no tiene un código de juego legible, algo habitual en el homebrew. PicoDex necesita ese código para comprobar el juego, así que aquí no hay nada que mostrar. Si el juego arranca, no hay nada que hacer.',
    noLists:
      'Los archivos del loader que necesita esta comprobación (aplist.bin, savelist.bin, patchlist.bin) no están en /_pico. La pestaña Salud muestra qué archivos del loader faltan.',
    revisionUnreadable: 'revisión desconocida (el loader la trata como revisión 0)',
    revision: (n: number) => `revisión ${String(n)}`,
    apLabel: 'Arreglo antipiratería',
    saveLabel: 'Guardado',
    patchLabel: 'Parche específico del juego',
    saveTypes: {
      none: 'Ninguno',
      eeprom: 'EEPROM',
      flash: 'Flash',
      nand: 'NAND',
      unknown: 'Desconocido',
    },
    mismatch: (kind: 'fix' | 'patch', entryVersions: number[], romVersion: number | null) => {
      const thing = kind === 'fix' ? 'un arreglo' : 'un parche';
      const noun = entryVersions.length === 1 ? 'la revisión' : 'las revisiones';
      const revs = entryVersions.join(', ');
      const romPart =
        romVersion === null
          ? 'no se pudo leer la revisión de tu copia (el loader asume entonces la revisión 0)'
          : `tu copia es la revisión ${String(romVersion)}`;
      return `El loader tiene ${thing} para ${noun} ${revs} de este juego, pero ${romPart}, así que no se usa. Si el juego se congela o falla, puede ser por esto.`;
    },
    ap: {
      notListed: 'No está en aplist.bin. La mayoría de los juegos no necesitan este arreglo.',
      skipped: 'No hace falta. El loader se salta este paso con el homebrew y el DSiWare.',
      applies: (dsProtectVersion: string | null) =>
        `El loader lo arregla al arrancar (DS Protect ${dsProtectVersion ?? 'desconocida'}).`,
      listUnavailable:
        'aplist.bin falta en /_pico o no se puede leer, así que esto no se puede comprobar. El loader necesita este archivo: revisa la pestaña Salud.',
    },
    save: {
      homebrewNone: 'El loader no crea archivo de guardado para homebrew.',
      dsiWareNone: 'Este juego DSiWare no guarda partida.',
      dsiWare: (pubSize: string, prvSize: string | null) =>
        `Guarda en un .pub de ${pubSize}${prvSize ? ` y un .prv de ${prvSize}` : ''} junto al juego.`,
      nandHeader: (size: string) => `NAND, ${size}`,
      defaultSize:
        'No está en savelist.bin, así que el loader crea un archivo de guardado de 512 KB.',
      none: 'Ninguno — este juego no guarda.',
      listed: (type: string, size: string) => `${type}, ${size}`,
    },
    patch: {
      notListed: 'No está en patchlist.bin. La mayoría de los juegos no necesitan parche.',
      skipped: 'No hace falta. El loader no parchea el homebrew.',
      applied: (count: number) =>
        count === 1
          ? '1 parche aplicado al arrancar.'
          : `${String(count)} parches aplicados al arrancar.`,
      listUnavailable:
        'patchlist.bin falta en /_pico o no se puede leer, así que esto no se puede comprobar. Las versiones antiguas de pico-loader no traen este archivo, y al actualizar el loader se añade.',
    },
    hints: {
      ap: {
        retail:
          'Algunos juegos se congelan a propósito cuando detectan una flashcart. El loader lo evita al arrancar, con aplist.bin y con unos pocos arreglos que lleva integrados. PicoDex solo puede comprobar aplist.bin.',
        dsiware:
          'La protección antipiratería es cosa de cartuchos. Los títulos DSiWare nunca estuvieron en un cartucho, así que el loader no ejecuta ese paso para ellos.',
        homebrew:
          'La protección antipiratería es algo que hacen los juegos comerciales. El loader no ejecuta nada de esa maquinaria para homebrew, así que no hay nada que comprobar.',
      },
      save: {
        retail:
          'Los cartuchos originales llevan dentro un chip de guardado. El loader lo sustituye por un archivo de guardado en tu tarjeta SD.',
        dsiware:
          'Los juegos DSiWare guardan en archivos, no en un chip de cartucho. El loader crea esos archivos junto al juego, con los tamaños que pide el propio juego.',
        homebrew:
          'El homebrew gestiona sus propios archivos en la tarjeta SD, así que el loader no le crea un guardado. Lo que esta ROM guarde, lo guarda por su cuenta.',
      },
      patch: {
        retail:
          'Unos pocos juegos necesitan un pequeño arreglo para funcionar bien desde una flashcart. El loader lo aplica al arrancar, desde patchlist.bin o desde arreglos que lleva integrados. PicoDex solo puede comprobar patchlist.bin.',
        dsiware:
          'Unos pocos juegos necesitan un pequeño arreglo para funcionar bien desde una flashcart, y los DSiWare también pueden recibirlo. El loader lo aplica al arrancar, desde patchlist.bin o desde arreglos que lleva integrados. PicoDex solo puede comprobar patchlist.bin.',
        homebrew:
          'Estos arreglos son para juegos comerciales. El loader no aplica ninguno al homebrew, que se ejecuta tal cual.',
      },
    },
  },
  banner: {
    dialogLabel: (system: string) => `Editar el banner de carpeta de ${system}`,
    heading: (path: string) => `Banner de carpeta — ${path}/`,
    close: 'Cerrar',
    sharedNote: (others: string, last: string) =>
      `Esta carpeta contiene ${others} y ${last}. Comparten un solo banner, así que guardar aquí cambia el icono y el nombre de todos.`,
    loadFailed: (detail: string) => `No se pudo leer el banner actual: ${detail}`,
    readingCurrent: 'Leyendo el banner actual…',
    previewLabel: 'Vista previa del banner',
    titleLabel: 'Título',
    titlePlaceholder: 'Título de carpeta que muestra el launcher',
    iconLegend: 'Icono',
    iconSource: 'Origen del icono',
    keepCurrent: 'Mantener el actual',
    fromImage: 'Desde una imagen',
    fromGame: 'Desde un juego',
    imageFileLabel: 'Archivo de imagen del icono',
    needsNewer:
      'Los banners de carpeta necesitan un Pico Launcher más nuevo que la v1.3.0. Con la versión v1.3.0 la consola sigue mostrando el nombre y el icono normales de la carpeta.',
    imageHint:
      'Tu imagen se ajusta a 32×32 y se reduce a 15 colores. La vista previa de arriba muestra exactamente cómo se verá en la DS.',
    imageFailed: (detail: string) => `No se pudo leer la imagen: ${detail}`,
    gamePicker: 'Juego del que tomar el icono',
    chooseGame: 'Elige un juego…',
    readingRom: 'Leyendo el banner de la ROM…',
    noRomBanner: 'Esta ROM no tiene icono de banner.',
    cannotOpen: (path: string) => `No se pudo abrir ${path}`,
    removeConfirm: (file: string) => `¿Quitar ${file}?`,
    remove: 'Quitar',
    removing: 'Quitando…',
    cancel: 'Cancelar',
    removeBanner: 'Quitar banner',
    writes: 'Escribe en ',
    writing: 'Escribiendo…',
    saveBanner: 'Guardar banner',
    writeFailed: (detail: string) => `Falló la escritura: ${detail}`,
    removeFailed: (detail: string) => `Falló el borrado: ${detail}`,
  },
  gallery: {
    sectionLabel: (system: string) => `Juegos de ${system}`,
    back: '← Biblioteca',
    shownOf: (shown: number, total: number) => `${shown} de ${total}`,
    gameCount: (count: number) => (count === 1 ? '1 juego' : `${count} juegos`),
    searchPlaceholder: (system: string) => `Buscar en ${system}…`,
    searchLabel: (system: string) => `Buscar juegos de ${system}`,
    filters: 'Filtros',
    favorites: 'Favoritos',
    completed: 'Completados',
    loadError: (message: string) => `No se pudieron cargar las carátulas: ${message}`,
    loadingCovers: (done: number, total: number) => `Cargando carátulas ${done}/${total}…`,
    noGames: (system: string) => `No hay juegos de ${system} en esta tarjeta SD.`,
    noMatches: 'Ningún juego coincide con tu búsqueda.',
    playTime: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
    launches: (count: number) => `${count}x`,
    coverAlt: (title: string) => `Carátula de ${title}`,
    changeCover: (title: string) => `Cambiar la carátula de ${title}`,
    resolving: 'Identificando el juego…',
    pickBoxArt: 'Elige la carátula correcta',
    toggleFavorite: (title: string) => `Alternar favorito de ${title}`,
    removeFavorite: 'Quitar de favoritos',
    markFavorite: 'Marcar como favorito',
    toggleCompleted: (title: string) => `Alternar completado de ${title}`,
    unmarkCompleted: 'Desmarcar como completado',
    markCompleted: 'Marcar como completado',
    editStats: (title: string) => `Editar estadísticas de ${title}`,
    correctStats: 'Corregir partidas y tiempo de juego',
    loaderCompat: (title: string) => `Compatibilidad del loader para ${title}`,
    loaderCompatHint: 'Qué hace el loader con este juego',
  },
  health: {
    title: 'Salud de la tarjeta',
    openCard: 'Abre una tarjeta SD para hacer un chequeo de salud.',
    intro:
      'Revisa la tarjeta en busca de basura de macOS, archivos del loader que falten, guardados huérfanos y carátulas huérfanas. No se borra nada sin confirmación.',
    scanCard: 'Escanear tarjeta',
    scanning: 'Escaneando…',
    scanningCount: (count: number) =>
      count === 1 ? 'Escaneando… 1 archivo' : `Escaneando… ${count} archivos`,
    libraryRereadFailed:
      'PicoDex no pudo leer los juegos de tu tarjeta (mira el error de arriba), así que paró el escaneo. Comprueba que la tarjeta sigue conectada y pulsa Escanear tarjeta otra vez.',
    scannedFiles: (count: number) =>
      count === 1 ? 'Se escaneó 1 archivo.' : `Se escanearon ${count} archivos.`,
    skippedFolders: (count: number) =>
      count === 1
        ? 'Se omitió 1 carpeta que tu equipo no deja abrir a PicoDex (es normal en carpetas del sistema):'
        : `Se omitieron ${count} carpetas que tu equipo no deja abrir a PicoDex (es normal en carpetas del sistema):`,
    deleting: 'Borrando…',
    yesDelete: 'Sí, borrar',
    no: 'No',
    junkTitle: 'Basura de macOS',
    junkNone: 'No se encontraron archivos basura de macOS.',
    junkCount: (count: number, size: string) =>
      count === 1 ? `1 archivo basura (${size})` : `${count} archivos basura (${size})`,
    junkKinds1: 'que deja macOS: archivos ',
    junkKinds2: ' y ',
    junkKinds3: '. Se pueden borrar sin problema.',
    showJunk: 'Ver archivos basura',
    junkCleanLabel: (count: number) =>
      count === 1 ? 'Limpiar 1 archivo' : `Limpiar ${count} archivos`,
    junkConfirmLabel: (count: number) =>
      count === 1 ? '¿Confirmas borrar 1 archivo?' : `¿Confirmas borrar ${count} archivos?`,
    junkDeleteFailed: (files: string) =>
      `No se pudieron borrar: ${files}. No afectan al launcher, así que puedes dejarlos.`,
    macosKeeps1: 'macOS guarda ',
    macosKeeps2:
      ' en la tarjeta y los vuelve a crear cada vez que la conectas a un Mac. No afectan al launcher, así que puedes dejarlos.',
    fsevents1: ' solo contiene un archivo ',
    fsevents2:
      ', que evita que macOS guarde un registro de cambios en la tarjeta. Déjalo como está.',
    loaderTitle: 'Archivos del loader',
    loaderAllPresent: 'Están todos los archivos necesarios del loader.',
    loaderMissing1: 'Falta ',
    loaderMissing2: ' — el loader lo necesita para arrancar juegos.',
    downloadFrom1: 'Descárgalos de las ',
    downloadReleases: 'versiones de pico-loader',
    downloadFrom2: ' y copia los archivos en ',
    downloadFrom3: '.',
    loaderIs: 'Loader ',
    orJoiner: ' o ',
    loaderBuild1: ', build ',
    loaderBuild2: '.',
    loaderEnd: '.',
    ambiguityIdentical:
      ' Esas versiones tienen exactamente los mismos archivos, así que da igual cuál tengas.',
    ambiguityIncomplete:
      ' PicoDex no puede saber cuál, porque los archivos que las distinguen faltan o no los reconoce. Si tus juegos arrancan, no tienes que hacer nada.',
    releasesBehind1: (count: number, atLeast: boolean) =>
      `${atLeast ? 'Al menos ' : ''}${count} ${count === 1 ? 'versión' : 'versiones'} por detrás de `,
    releasesBehind2:
      '. Para actualizar, descárgala de las versiones de pico-loader y copia todos sus archivos en /_pico.',
    newestKnownCandidate: (tag: string) =>
      `Una de ellas es ${tag}, la versión más nueva que PicoDex conoce, así que puede que ya estés al día.`,
    newestKnownMaybe:
      'Esa es la versión más nueva que PicoDex conoce. Puede existir algo más nuevo.',
    newestRelease: 'Esa es la versión más nueva.',
    mixed1: (agreeing: number) =>
      agreeing === 1
        ? 'Tu loader está actualizado solo a medias: 1 de sus archivos es de '
        : `Tu loader está actualizado solo a medias: ${agreeing} de sus archivos son de `,
    mixed2: ', pero ',
    andJoiner: ' y ',
    mixed3: (count: number) =>
      count === 1
        ? 'no lo es. Suele pasar al copiar solo algunos de los archivos y no el resto.'
        : 'no lo son. Suele pasar al copiar solo algunos de los archivos y no el resto.',
    copyAgain1: 'Vuelve a copiarlos todos desde una sola ',
    copyAgainRelease: 'versión de pico-loader',
    copyAgainOverwrites:
      '. Eso también sustituye los archivos que PicoDex no reconoce (aparecen abajo), así que si editaste alguno a mano, guarda antes una copia.',
    copyAgainEnd: '.',
    unrecognisedAll:
      'PicoDex no reconoce ninguno de estos archivos, así que no puede saber qué versión del loader tienes. Pasa cuando son de una versión más nueva que PicoDex o cuando se editaron a mano. Si tus juegos arrancan, no tienes que hacer nada.',
    unrecognisedListed1:
      'PicoDex no reconoce estos archivos, así que no los tuvo en cuenta para calcular la versión: ',
    unrecognisedListed2: '. Pasa cuando se editan a mano (es habitual con ',
    unrecognisedListed3:
      '), cuando son de una versión del loader más nueva que PicoDex o cuando son de una compilación propia.',
    unrecognisedFine: 'Si tus juegos arrancan, no tienes que hacer nada.',
    githubNewer1: 'La versión más nueva de pico-loader en GitHub es ',
    githubNewer2: (tag: string) =>
      `. PicoDex aún no conoce ${tag}, así que no puede saber si tu tarjeta ya la tiene. Si la quieres, descárgala de las versiones de pico-loader y copia todos sus archivos en /_pico.`,
    unreadable:
      'PicoDex no pudo abrir algunos archivos del loader, así que no los comprobó. Vuelve a escanear y, si sigue pasando, cópialos otra vez desde la versión de pico-loader. Archivos: ',
    optional1: 'Archivos opcionales que no están en la tarjeta: ',
    optional2: ' — no pasa nada por no tenerlos.',
    savesTitle: 'Guardados huérfanos',
    savesSkipped:
      'Sin comprobar: PicoDex no encontró juegos en la tarjeta, así que no puede saber qué guardados pertenecen a un juego.',
    savesAllOk: 'Todos los guardados pertenecen a un juego de la tarjeta.',
    savesOrphans: (count: number) =>
      count === 1
        ? '1 guardado no pertenece a ningún juego: no hay ningún juego con su mismo nombre en su carpeta, ni en la carpeta de arriba cuando el guardado está en una carpeta saves. El launcher no lo usará. Si moviste o renombraste un juego, mueve o renombra su guardado igual para conservar tu progreso. Borrar es permanente: marca solo los guardados que tengas claro que no necesitas.'
        : `${count} guardados no pertenecen a ningún juego: no hay ningún juego con su mismo nombre en su carpeta, ni en la carpeta de arriba cuando el guardado está en una carpeta saves. El launcher no los usará. Si moviste o renombraste un juego, mueve o renombra su guardado igual para conservar tu progreso. Borrar es permanente: marca solo los guardados que tengas claro que no necesitas.`,
    savesDeleteLabel: (count: number) => `Borrar seleccionados (${count})`,
    savesDuplicates: (count: number) =>
      count === 1
        ? '1 juego tiene su guardado dos veces: uno junto al juego y otro en la carpeta saves. Pico Launcher usa el que está junto al juego y TWiLight Menu++ el de la carpeta saves, así que lo que avances en uno no se verá en el otro. PicoDex no sabe cuál tiene tu progreso más reciente, así que no toca ninguno. Si solo usas un launcher, el otro guardado te sobra; si usas los dos, quédate con el que tenga tu progreso y quita el otro.'
        : `${count} juegos tienen su guardado dos veces: uno junto al juego y otro en la carpeta saves. Pico Launcher usa el que está junto al juego y TWiLight Menu++ el de la carpeta saves, así que lo que avances en uno no se verá en el otro. PicoDex no sabe cuál tiene tu progreso más reciente, así que no toca ninguno. Si solo usas un launcher, el otro guardado te sobra; si usas los dos, quédate con el que tenga tu progreso y quita el otro.`,
    savesDuplicateBeside: 'junto al juego: ',
    savesDuplicateInFolder: 'en la carpeta saves: ',
    savesConfirmLabel: (count: number) =>
      count === 1
        ? '¿Confirmas borrar permanentemente 1 guardado?'
        : `¿Confirmas borrar permanentemente ${count} guardados?`,
    coversTitle: 'Carátulas de usuario huérfanas',
    coversSkipped:
      'Sin comprobar: PicoDex no encontró juegos en la tarjeta, así que no puede saber qué carátulas pertenecen a un juego.',
    coversAllOk: 'Todas las carátulas de usuario pertenecen a un juego de la tarjeta.',
    coversOrphans1: (count: number) => (count === 1 ? '1 carátula en ' : `${count} carátulas en `),
    coversOrphans2: (count: number) =>
      count === 1
        ? ' no corresponde a ningún juego de la tarjeta, normalmente porque el juego se renombró o se borró. Viene marcada para borrarla: desmárcala si quieres conservarla. Puedes volver a descargar carátulas desde la pestaña Carátulas.'
        : ' no corresponden a ningún juego de la tarjeta, normalmente porque los juegos se renombraron o se borraron. Vienen marcadas para borrarlas: desmarca las que quieras conservar. Puedes volver a descargar carátulas desde la pestaña Carátulas.',
    coversCleanLabel: (count: number) => `Limpiar seleccionadas (${count})`,
    badCoversTitle: 'Carátulas que el launcher no puede mostrar',
    badCoversAllOk: 'Todas las carátulas de la tarjeta están en el formato que lee el launcher.',
    badCovers: (count: number) =>
      count === 1
        ? '1 carátula no está en el formato que lee el launcher, así que en la consola se ve como ruido o no se ve. Suele pasar al guardar la imagen con un editor. Abre el juego en la pestaña Carátulas y guarda la carátula otra vez: PicoDex la escribe en el formato correcto.'
        : `${count} carátulas no están en el formato que lee el launcher, así que en la consola se ven como ruido o no se ven. Suele pasar al guardar la imagen con un editor. Abre cada juego en la pestaña Carátulas y guarda la carátula otra vez: PicoDex la escribe en el formato correcto.`,
    coversConfirmLabel: (count: number) =>
      count === 1 ? '¿Confirmas borrar 1 carátula?' : `¿Confirmas borrar ${count} carátulas?`,
  },
  screenshots: {
    regionLabel: 'Capturas',
    title: 'Capturas',
    intro:
      'Todas las capturas de la tarjeta, con las dos pantallas de un momento en una sola imagen.',
    openCard: 'Abre una tarjeta SD para ver sus capturas.',
    // Va alrededor de un <kbd>; el JSX pone la tecla entre las dos mitades.
    empty1: 'Esta tarjeta aún no tiene capturas. En el launcher, mantén ',
    empty2: ' medio segundo para guardar las dos pantallas.',
    listing: 'Leyendo la carpeta de capturas…',
    loading: (done: number, total: number) => `Leyendo capturas ${done}/${total}…`,
    loadError: (message: string) => `No se pudieron leer las capturas: ${message}`,
    count: (count: number) => (count === 1 ? '1 captura' : `${String(count)} capturas`),
    captureAlt: (id: string) => `Captura ${id}`,
    topOnly: 'solo la pantalla superior',
    bottomOnly: 'solo la pantalla inferior',
    unreadable: 'No se pudo leer',
    open: 'Ver a tamaño completo',
    close: 'Cerrar',
    download: 'Guardar como PNG',
    previous: 'Captura anterior',
    next: 'Captura siguiente',
    deleteCapture: 'Borrar',
    confirmDelete: '¿Borrar esta captura de la tarjeta?',
    yesDelete: 'Sí, borrar',
    no: 'No',
    deleting: 'Borrando…',
    folderGone: 'La carpeta de capturas ya no está en la tarjeta.',
    deleteError: (message: string) => `No se pudo borrar: ${message}`,
    deleted: (name: string) => `${name} borrada de la tarjeta.`,
  },
  dex3ds: {
    compatBanner:
      'Modo Compatible (Firefox / solo lectura): los cambios se preparan en memoria hasta que los exportes.',
    compatOpenBtn: 'Abrir carpeta en Modo Compatible (Firefox / .zip)',
    compatExportBtn: (count: number) =>
      count > 0 ? `Exportar cambios (.zip · ${count})` : 'Exportar .zip (sin cambios aún)',
    compatPending: (written: number, deleted: number) =>
      `${written} cambios preparados · ${deleted} eliminaciones confirmadas (solo tras confirmar una vista previa)`,
    auditTitle: 'Salud y Auditoría SD 3DS',
    auditIntro:
      'Verifica archivos críticos de arranque (boot.firm, boot.3dsx, GodMode9), basura del sistema, .cia/.3dsx desubicados y estado de FBI/NSA.',
    rescan: 'Reescanear SD',
    scanning: (count: number) => `Escaneando… ${count} archivos`,
    criticalTitle: 'Archivos críticos de arranque y CFW',
    bootFirmOk: 'boot.firm (Luma3DS) presente en la raíz de la SD.',
    bootFirmMissing:
      'Falta boot.firm en la raíz de la SD — la consola podría no arrancar sin Luma en CTRNAND.',
    boot3dsxOk: 'boot.3dsx (Homebrew Launcher) presente en la raíz de la SD.',
    boot3dsxMissing: 'Falta boot.3dsx en la raíz de la SD.',
    gm9Ok: 'Payload GodMode9 encontrado en /luma/payloads/.',
    gm9Missing: 'No se encontró payload GodMode9 (.firm) en /luma/payloads/.',
    lumaConfigOk: '/luma/config.ini presente.',
    lumaConfigMissing: 'No se encontró /luma/config.ini (se crea al iniciar Luma3DS).',
    fbiNsaTitle: 'Gestor de títulos (FBI / NSA)',
    fbiNsaRecommend:
      'Se detectó una carpeta de FBI sin NSA. Recomendamos instalar NSA, un fork moderno de FBI con transferencias 3DS a 3DS y actualizador integrado.',
    fbiNsaLink: 'Ver NSA en GitHub',
    misplacedTitle: 'Archivos sueltos en la raíz de la SD',
    misplacedNone: 'No hay archivos .cia ni .3dsx sueltos en la raíz.',
    misplacedHint:
      'Los archivos .cia y .3dsx en la raíz desordenan la SD. Muévelos a /cias/ y /3ds/ respectivamente.',
    moveToSuggested: 'Mover a carpeta estándar',
    moving: 'Moviendo…',
    movedCount: (count: number) => `Se movieron ${count} archivo(s) a sus carpetas estándar.`,
    junkTitle: 'Basura del sistema y archivos residuales',
    junkNone: 'No se detectaron archivos basura de macOS o del sistema.',
    junkClean: 'Eliminar basura del sistema',
    junkConfirm: (count: number) => `¿Eliminar ${count} elemento(s) basura?`,
    cfwPreviewTitle: 'CFW y Versiones de Arranque',
    cfwPreviewBody:
      'Verificación SHA-256 y consulta de GitHub Releases para componentes críticos de 3DS, con respaldo automático previo.',
    protectedNote:
      'Las carpetas protegidas (/Nintendo 3DS/ y /boot9strap/) nunca se modifican ni se analizan para borrado.',
    spaceToFree: (size: string) => `Espacio a liberar: ${size}`,
    leftoversTitle: 'Residuos e instaladores opcionales',
    leftoversNone: 'No se encontraron archivos .bak antiguos, logs ni instaladores .cia.',
    leftoversHint:
      'Selecciona respaldos antiguos, logs o archivos .cia ya instalados que quieras eliminar.',
    deleteSelected: (count: number, size: string) => `Eliminar seleccionados (${count} · ${size})`,
    homebrewTitle: 'Homebrew (Universal-DB)',
    homebrewIntro:
      'Explora homebrew de 3DS desde Universal-DB e instala o actualiza directo a tu SD.',
    homebrewRefresh: 'Actualizar catálogo',
    homebrewSearch: 'Buscar app, autor, descripción…',
    homebrewAllCategories: 'Todas las categorías',
    homebrewOnlyInstalled: 'Solo instaladas en la SD',
    installedBadge: 'Instalada',
    installBtn: 'Instalar',
    updateBtn: 'Actualizar',
    installing: 'Descargando y verificando…',
    tmTitle: 'TWiLight Menu++ (TM++)',
    tmIntro:
      'Comprueba el estado de TWiLight Menu++ y descarga automáticamente las carátulas faltantes.',
    tmStatusTitle: 'Estado de TWiLight Menu++',
    tmCoversTitle: 'Carátulas automáticas (Boxart)',
    tmCoversSummary: (total: number, covered: number, missing: number) =>
      `${total} juegos encontrados · ${covered} con carátula · ${missing} sin carátula`,
    tmDownloadMissing: (count: number) => `Descargar carátulas faltantes (${count})`,
    tmDownloading: 'Descargando carátulas…',
    tmDownloadResult: (downloaded: number, notFound: number, errors: number) =>
      `Descargadas ${downloaded} carátula(s) · ${notFound} sin coincidencia · ${errors} error(es).`,
    versionLabel: 'Versión',
    statusUpToDate: 'Actualizado',
    statusOutdated: 'Desactualizado',
    statusUnrecognised: 'No reconocido / personalizado',
    statusUnknownVersion: 'Sin versión detectada',
    statusMissing: 'Faltante',
    detectedLabel: 'Detectada',
    installedLabel: 'Instalada',
    latestLabel: 'Última',
    versionSourceHash: 'Versión por SHA-256 conocido',
    versionSourceBinary: 'Versión leída del binario',
    versionSourceFile: 'Versión leída de un archivo en /_nds/',
    replaceWithBackup: 'Actualizar desde archivo (con respaldo)',
    safeBackupDone: (written: string, backup: string) =>
      `Actualizado /${written} con seguridad (respaldo previo en /${backup}).`,
    safeWriteDone: (written: string) => `Escrito /${written} y verificado por SHA-256.`,
    bootstrapTitle: 'nds-bootstrap (independiente de TWiLight Menu++)',
    bootstrapNote:
      'Versión leída solo de /_nds/release-bootstrap.ver o de binarios de nds-bootstrap; nunca de archivos de TWiLight Menu++.',
    utilitiesTitle: 'Utilidades Homebrew detectadas',
    tabHomebrew: 'Homebrew',
    tabTwilight: 'TM++',
    tabBackups: 'Respaldos',
    // Vista previa obligatoria antes de cualquier cambio.
    previewTitle: 'Vista previa (simulación)',
    previewDirect: 'Modo directo: al confirmar, estos cambios se aplicarán en la tarjeta SD.',
    previewCompat:
      'Modo compatible: al confirmar, estos cambios se preparan en memoria y se listan en el manifiesto del .zip exportado.',
    previewBlocked: (count: number) =>
      `${count} operación(es) bloqueada(s): las carpetas críticas del sistema nunca se modifican.`,
    previewEmpty: 'No hay cambios permitidos para mostrar.',
    previewMore: (count: number) => `… y ${count} más.`,
    previewCounts: (create: number, backup: number, move: number, deleted: number, size: string) =>
      `Crear: ${create} · Respaldo: ${backup} · Mover: ${move} · Borrar: ${deleted} · Tamaño: ${size}`,
    previewConfirm: '¿Aplicar exactamente estos cambios?',
    previewYes: 'Sí, aplicar cambios',
    previewApplying: 'Aplicando…',
    previewCancel: 'Cancelar',
    // Arranque y configuración de Luma (solo lectura).
    bootTitle: 'Arranque y configuración de Luma',
    bootIntro:
      'Comprobación de solo lectura de boot.firm, boot.3dsx, payloads y /luma/config.ini. Nada se reescribe.',
    bootInspecting: 'Comprobando archivos de arranque…',
    bootReadError: (message: string) =>
      `No se pudo completar la comprobación de arranque: ${message}`,
    bootBootFirm: (size: string) => `boot.firm presente en la raíz (${size}).`,
    bootBoot3dsx: (size: string) => `boot.3dsx presente en la raíz (${size}).`,
    bootPayloads: (count: number) => `${count} payload(s) .firm en /luma/payloads/.`,
    bootPayloadNone: 'No se encontraron payloads .firm en /luma/payloads/.',
    bootDuplicates: (count: number) => `${count} grupo(s) de nombres de payload duplicados.`,
    bootOutdated: (count: number) =>
      `${count} payload(s) coinciden con una versión antigua conocida.`,
    bootConfigOk: (version: string) =>
      `/luma/config.ini presente (versión de configuración ${version}).`,
    bootConfigMissing: 'Falta /luma/config.ini; Luma3DS lo crea en el primer arranque.',
    bootConfigUnreadable: 'No se pudo leer /luma/config.ini.',
    bootConfigClean: 'No se detectaron ajustes atípicos.',
    bootConfigFindings: (count: number) =>
      `${count} ajuste(s) atípico(s) que conviene revisar en la consola.`,
    bootConfigFinding: {
      'missing-meta':
        'No hay sección [meta]: puede que la configuración no haya sido generada por Luma3DS.',
      'missing-version': 'Faltan config_version_major/minor en [meta].',
      'unknown-version': 'Versión de configuración no reconocida: ',
      'autoboot-emunand': 'autoboot_emunand está activo: la consola arranca en emuNAND.',
      'autoboot-mode': 'autoboot_mode es atípico: revisa el menú de arranque de Luma.',
      'pin-lock': 'Hay un PIN configurado: asegúrate de conocer el código.',
      'game-patching-off':
        'El parcheo de juegos está desactivado; no se cargarán LayeredFS ni traducciones.',
      'external-firm-off': 'La carga de FIRM/módulos externos está desactivada.',
      'new3ds-cpu': 'El refuerzo de CPU de New 3DS está activo al arrancar.',
      'dev-unitinfo': 'La información de unidad de desarrollador está activada.',
    },
    // Informe informativo de /3ds/: los .3dsx en la raíz funcionan tal cual.
    appsTitle: 'Apps y disposición en /3ds/',
    appsIntro:
      'Los lanzadores .3dsx en la raíz funcionan tal cual y las carpetas con guardados, configuración o cachés son normales. Solo se listan las carpetas realmente vacías, los duplicados por mayúsculas y los archivos grandes sueltos; no se borra nada sin una vista previa y confirmación explícitas.',
    appsNone: 'Nada que requiera revisión.',
    appsAppFolders: (count: number) => `${count} carpeta(s) de apps`,
    appsRootLaunchers: (count: number) =>
      `${count} lanzador(es) .3dsx en la raíz de /3ds/ (funcionan tal cual)`,
    appsEmptyFolders: (count: number) => `${count} carpeta(s) vacía(s)`,
    appsFindingsCount: (count: number) => `${count} elemento(s) que conviene revisar`,
    appsFinding: {
      'empty-folder': 'carpeta vacía: no contiene archivos ni subcarpetas',
      duplicate: 'el nombre solo difiere en mayúsculas de otra entrada',
      'heavy-file': 'archivo grande suelto en la raíz de /3ds/',
    },
    appsReview: (count: number) => `Revisar vista previa de limpieza (${count})`,
    appsShowAll: 'Ver todos',
    appsShowLess: 'Ver menos',
    appsCleaned: (count: number) => `Se quitaron ${count} elemento(s) tras confirmar.`,
    // Visor de respaldos locales.
    backupsTitle: 'Respaldos locales',
    backupsIntro:
      'Explora volcados de GodMode9, guardados de JKSV y Checkpoint y respaldos de seguridad de 3DSdex con fecha y tamaño.',
    backupsProtected: 'Solo lectura: /Nintendo 3DS/ y /boot9strap/ nunca se incluyen.',
    backupsFound: (count: number, size: string) => `${count} paquete(s) · ${size} en total`,
    backupsNone: 'No se encontraron paquetes de respaldo en esta tarjeta.',
    backupsScanning: 'Escaneando respaldos…',
    backupsSelectAll: 'Seleccionar todo',
    backupsUnselectAll: 'Deseleccionar todo',
    backupsReview: (count: number) => `Previsualizar exportación (${count})`,
    backupsExport: 'Exportar paquetes seleccionados (.zip)',
    backupsExported: (count: number) => `Se exportaron ${count} paquete(s) de respaldo como .zip.`,
    backupsFiles: (count: number) => `${count} archivo(s)`,
    backupsDate: (date: string) => `Fecha: ${date}`,
    backupsSource: {
      gm9: 'GodMode9',
      jksv: 'JKSV',
      checkpoint: 'Checkpoint',
      '3dsdex': 'Respaldo de seguridad 3DSdex',
    },
    // Checklist posterior a la actualización.
    checklistTitle: 'Tras actualizar: checklist rápido',
    checklistIntro:
      'Comprueba cada punto en la consola. 3DSdex no puede verificar lo que hace la consola tras reiniciar.',
    checklistZip:
      'Modo compatible: extrae el .zip exportado en la RAÍZ de tu SD, manteniendo las rutas de carpetas.',
    checklistDismiss: 'Cerrar',
    checklistAllDone: 'Todas las comprobaciones hechas.',
    checklistPending: (count: number) => `Quedan ${count} comprobación(es).`,
    checkLuma:
      'Arranca la consola y confirma que Luma3DS muestra la versión nueva en su menú de arranque.',
    checkGm9: 'Mantén pulsada la tecla del payload y confirma que GodMode9 arranca y lee la SD.',
    checkTwilight: 'Abre TWiLight Menu++ y confirma su versión y lista de juegos.',
    checkHbmenu: 'Abre el Homebrew Launcher y confirma que carga boot.3dsx.',
  },
};
