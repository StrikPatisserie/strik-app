type PrintSection<Section, Stop> = { section: Section; stops: Stop[] };
type PrintLayout<Section, Stop, Page, Fragment, PlacedStop> = {
  createPage(): Page;
  appendFragment(page: Page, section: Section, continued: boolean): Fragment;
  appendStop(fragment: Fragment, stop: Stop): PlacedStop;
  removeFragment(fragment: Fragment): void;
  removeStop(stop: PlacedStop): void;
  fits(page: Page): boolean;
};

/** Uses measured page height, never a guessed number of stops. Self-contained
 * so the same algorithm can run inside the standalone iPad print document. */
export function paginateRoutePrint<Section, Stop, Page, Fragment, PlacedStop>(
  routes: PrintSection<Section, Stop>[],
  layout: PrintLayout<Section, Stop, Page, Fragment, PlacedStop>
) {
  const pages: Page[] = [];
  let page: Page;
  let pageHasContent = false;
  const nextPage = () => {
    page = layout.createPage();
    pages.push(page);
    pageHasContent = false;
  };
  for (const route of routes) {
    if (route.stops.length === 0) continue;
    if (pages.length === 0) nextPage();
    const wholeRound = () => {
      const fragment = layout.appendFragment(page, route.section, false);
      for (const stop of route.stops) layout.appendStop(fragment, stop);
      if (layout.fits(page)) { pageHasContent = true; return true; }
      layout.removeFragment(fragment);
      return false;
    };
    if (wholeRound()) continue;
    // Prefer a complete round on the next page over splitting it across pages.
    if (pageHasContent) { nextPage(); if (wholeRound()) continue; }
    let fragment = layout.appendFragment(page!, route.section, false);
    let fragmentCount = 0;
    for (const stop of route.stops) {
      const placed = layout.appendStop(fragment, stop);
      if (layout.fits(page!)) { fragmentCount++; pageHasContent = true; continue; }
      layout.removeStop(placed);
      if (fragmentCount === 0) throw new Error("Een stop met alle gegevens past niet op één A4. Controleer de lange stoptekst in de route; er wordt niets weggelaten.");
      nextPage();
      fragment = layout.appendFragment(page!, route.section, true);
      layout.appendStop(fragment, stop);
      if (!layout.fits(page!)) throw new Error("Een stop met alle gegevens past niet op één A4. Controleer de lange stoptekst in de route; er wordt niets weggelaten.");
      fragmentCount = 1;
      pageHasContent = true;
    }
  }
  return pages;
}

export function routePrintPaginationScript() {
  return `(() => {
    const paginate = ${paginateRoutePrint.toString()};
    const root = document.querySelector('.route-pages');
    const status = document.querySelector('.print-status');
    const button = document.querySelector('[data-route-print]');
    const guide = document.querySelector('.page-height-guide');
    const sourcePages = [...root.querySelectorAll('.route-page')].map(page => page.cloneNode(true));
    const routes = sourcePages.flatMap(page => [...page.querySelectorAll('.route-block')].map(section => ({ section, stops: [...section.querySelectorAll('.stop-card')] })));
    const expected = Number(root.dataset.stopCount);
    let sequence = 0;
    routes.forEach(route => route.stops.forEach(stop => { stop.dataset.printStop = String(sequence++); }));
    let preparing = false;
    function prepare() {
      if (preparing) return false;
      preparing = true;
      document.body.dataset.routePreparing = 'true';
      document.body.dataset.routeReady = 'false';
      button.disabled = true;
      try {
        if (sequence !== expected || !sourcePages[0]) throw new Error('De route is niet volledig geladen. Open de routeprint opnieuw.');
        const limit = guide.getBoundingClientRect().height;
        if (!(limit > 0)) throw new Error('De papiermaat kon niet worden bepaald. Open de routeprint opnieuw.');
        root.replaceChildren();
        const pages = paginate(routes, {
          createPage() {
            const page = sourcePages[0].cloneNode(true);
            page.querySelector('.route-sections').replaceChildren();
            const direction = page.querySelector('.page-footer strong');
            direction.textContent = 'Z.O.Z. — VOLGENDE PAGINA';
            direction.className = '';
            root.append(page);
            return page;
          },
          appendFragment(page, section, continued) {
            const fragment = section.cloneNode(true);
            fragment.querySelector('.stops').replaceChildren();
            if (continued) fragment.querySelector('.route-title h2').append(' · vervolg');
            page.querySelector('.route-sections').append(fragment);
            return fragment;
          },
          appendStop(fragment, stop) { const clone = stop.cloneNode(true); fragment.querySelector('.stops').append(clone); return clone; },
          removeFragment(fragment) { fragment.remove(); },
          removeStop(stop) { stop.remove(); },
          fits(page) { return page.getBoundingClientRect().height <= limit; }
        });
        const placed = [...root.querySelectorAll('.stop-card')];
        if (placed.length !== expected || placed.some((stop, index) => stop.dataset.printStop !== String(index))) throw new Error('Niet alle stops staan in de juiste volgorde. Open de routeprint opnieuw.');
        pages.forEach((page, index) => {
          page.querySelector('.page-footer span').textContent = 'Pagina ' + (index + 1) + ' van ' + pages.length + ' · ' + expected + ' stops · gemaakt ' + root.dataset.generatedAt;
          page.dataset.routeCount = String(page.querySelectorAll('.route-block').length);
          if (index === pages.length - 1) {
            const end = page.querySelector('.page-footer strong');
            end.textContent = 'EINDE ROUTE';
            end.className = 'route-end';
          }
        });
        if (pages.some(page => page.getBoundingClientRect().height > limit)) throw new Error('De route past niet volledig op het papier. Open de routeprint opnieuw.');
        document.body.dataset.routeReady = 'true';
        status.textContent = pages.length + (pages.length === 1 ? ' pagina' : ' pagina’s') + ' · Alle ' + expected + ' stops compleet · A4 staand';
        button.disabled = false;
        return true;
      } catch (error) {
        root.replaceChildren(...sourcePages.map(page => page.cloneNode(true)));
        status.textContent = error.message || 'De volledige route kon niet worden ingedeeld.';
        return false;
      } finally { preparing = false; delete document.body.dataset.routePreparing; }
    }
    window.printPreparedRoute = () => { if (prepare()) window.print(); else window.alert(status.textContent); };
    window.addEventListener('beforeprint', prepare);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(prepare);
    else prepare();
  })();`;
}
