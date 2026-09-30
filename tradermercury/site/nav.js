// Chapter registry + sidebar, prev/next, chart + mermaid rendering. Classic script (works on file://).
const CHAPTERS = [
  {n:1,  part:'A · Read',   file:'01-simplicity.html',        title:'Simplicity: 4 states + 4-second rule'},
  {n:2,  part:'A · Read',   file:'02-timeframes.html',        title:'Timeframes: 200s cloud, snowball→snowman, scaling'},
  {n:3,  part:'A · Read',   file:'03-three-part-system.html', title:'The 3-part system; ranges & deviations'},
  {n:4,  part:'A · Read',   file:'04-regime.html',            title:'Regime: trend vs range vs chop; fair value'},
  {n:5,  part:'A · Read',   file:'05-btc-context.html',       title:'BTC context: spec vs interp, valid vs actionable, RS, recency'},
  {n:6,  part:'B · Trade',  file:'06-scan-filter.html',       title:'Bi-weekly scan & filter'},
  {n:7,  part:'B · Trade',  file:'07-setups-entries.html',    title:'Setups & entries: archetypes, bid vs reclaim'},
  {n:8,  part:'B · Trade',  file:'08-setup-math.html',        title:'Setup math: RR × probability × situation; sizing'},
  {n:9,  part:'B · Trade',  file:'09-stops-plans.html',       title:'Stops = invalidation; Plan A/B/A2/C'},
  {n:10, part:'B · Trade',  file:'10-take-profit.html',       title:'Taking profit & managing'},
  {n:11, part:'C · Invest', file:'11-cycle.html',             title:'Reading the cycle; dip vs downtrend; bottom buying'},
  {n:12, part:'C · Invest', file:'12-price-discovery.html',   title:'Riding the bull: price discovery, fib TPs, keeping profit'},
  {n:13, part:'C · Invest', file:'13-doing-nothing.html',     title:'Doing nothing; narratives; investor vs trader books'},
  {n:14, part:'D · Mind',   file:'14-never-wrong.html',       title:'Never wrong: adapt; confidence plateau'},
  {n:15, part:'D · Mind',   file:'15-discipline.html',        title:'Discipline: domino, overtrading, human error, journaling'},
  {n:16, part:'E · Loop',   file:'16-biweekly-ritual.html',   title:'The bi-weekly ritual checklist'},
];

(function () {
  const cur = +document.body.dataset.ch || 0;
  const base = cur ? '../' : '';            // chapter pages live in ch/
  const href = c => base + 'ch/' + c.file;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const side = document.getElementById('side');
  if (side) {
    let h = `<a class="home" href="${base}index.html">TraderMercury</a>`, part = '';
    for (const c of CHAPTERS) {
      if (c.part !== part) { if (part) h += '</ol>'; part = c.part; h += `<h3>${esc(part)}</h3><ol start="${c.n}">`; }
      h += `<li${c.n === cur ? ' class="cur"' : ''}><a href="${href(c)}">${esc(c.title)}</a></li>`;
    }
    side.innerHTML = h + `</ol><a class="gl" href="${base}glossary.html">Glossary</a>`;
  }

  const main = document.querySelector('main');
  if (cur && main) {
    const i = CHAPTERS.findIndex(c => c.n === cur), p = CHAPTERS[i - 1], n = CHAPTERS[i + 1];
    const nav = document.createElement('nav');
    nav.className = 'pn';
    nav.innerHTML = (p ? `<a href="${href(p)}">← ${p.n}. ${esc(p.title)}</a>` : `<a href="${base}index.html">← Home</a>`) +
                    (n ? `<a href="${href(n)}">${n.n}. ${esc(n.title)} →</a>` : `<a href="${base}glossary.html">Glossary →</a>`);
    main.appendChild(nav);
  }

  document.querySelectorAll('svg.chart[data-spec]').forEach(el => {
    try { TM.chart(el, JSON.parse(el.dataset.spec)); }
    catch (e) { console.error('chart spec', el, e); }
  });

  if (document.querySelector('.mermaid')) {
    const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then(m => {
      m.default.initialize({startOnLoad: false, theme: 'base', themeVariables: {
        primaryColor: v('--paper2'), primaryTextColor: v('--ink'), primaryBorderColor: v('--ink2'),
        lineColor: v('--ink2'), fontFamily: v('--sans'), fontSize: '14px'}});
      m.default.run();
    });
  }
})();
