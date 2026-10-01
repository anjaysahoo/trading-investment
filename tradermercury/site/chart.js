// TM.chart(target, spec) → SVG candle/line sketch. x = candle index, y = price.
// spec: {w,h,seed,path,legs,line,ma:[{len,label}],hl:[{y,label,dash}],box:[{x0,x1,y0,y1,label}],
//        mark:[{at,text}],arrow:[{x0,y0,x1,y1,text}],zone:[{x0,x1,kind:'bad'|'good'|'note',label}],title}
// ponytail: fake candles from waypoints — not real OHLC; add real data import only if a chapter truly needs it.
window.TM = window.TM || {};
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function rng(a) { // mulberry32
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Waypoints → candles. Leg k ends exactly on path[k+1]; wp[k] = candle index where close ≈ path[k].
  function candles(path, legs, r) {
    const out = [], wp = [0];
    let prev = path[0];
    for (let k = 0; k < path.length - 1; k++) {
      const a = path[k], b = path[k + 1], L = Math.max(1, Array.isArray(legs) ? (legs[k] || 6) : legs);
      const amp = Math.abs(b - a) * 0.25 || Math.abs(a) * 0.01;
      for (let j = 1; j <= L; j++) {
        const c = j === L ? b : a + (b - a) * j / L + (r() - 0.5) * amp;
        const o = prev, body = Math.abs(c - o) || amp * 0.2;
        out.push({o, c, hi: Math.max(o, c) + r() * body * 0.6, lo: Math.min(o, c) - r() * body * 0.6});
        prev = c;
      }
      wp.push(out.length - 1);
    }
    return {out, wp};
  }

  const sma = (v, n) => v.map((_, i) => i < n - 1 ? null : v.slice(i - n + 1, i + 1).reduce((s, x) => s + x, 0) / n);
  function ema(v, n) {
    const k = 2 / (n + 1), s = sma(v, n), out = [];
    let e = null;
    v.forEach((x, i) => { e = i < n - 1 ? null : e === null ? s[i] : x * k + e * (1 - k); out.push(e); });
    return out;
  }

  TM.chart = function (target, spec) {
    let svg = typeof target === 'string' ? document.querySelector(target) : target;
    if (svg.tagName.toLowerCase() !== 'svg') svg = svg.appendChild(document.createElementNS(NS, 'svg'));
    const S = Object.assign({w: 640, h: 240, seed: 1, legs: 6}, spec);
    const {out: cs, wp} = candles(S.path, S.legs, rng(S.seed));
    const N = cs.length, id = 'tm' + (++uid);
    const closes = cs.map(c => c.c);

    // y-range over candles + annotations
    const ys = cs.flatMap(c => [c.hi, c.lo]);
    (S.hl || []).forEach(h => ys.push(h.y));
    (S.box || []).forEach(b => ys.push(b.y0, b.y1));
    (S.arrow || []).forEach(a => ys.push(a.y0, a.y1));
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;

    const maxX = Math.max(N - 1, ...(S.arrow || []).map(a => Math.max(a.x0, a.x1)), ...(S.box || []).map(b => b.x1), ...(S.zone || []).map(z => z.x1));
    const L = 8, R = 84, T = S.title ? 26 : 10, B = 10, pw = S.w - L - R, ph = S.h - T - B;
    const X = i => L + (i + 0.5) * pw / (maxX + 1), Y = p => T + (hi - p) / (hi - lo) * ph;
    const cw = Math.max(1.5, pw / (maxX + 1) * 0.6);
    const f = n => +n.toFixed(1);

    let g = `<defs><marker id="${id}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="c-arrowhead"/></marker></defs>`;
    const text = (x, y, s, cls, anchor) => `<text x="${f(x)}" y="${f(y)}" class="${cls}"${anchor ? ` text-anchor="${anchor}"` : ''}>${String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;

    (S.zone || []).forEach(z => {
      const x0 = X(z.x0) - cw, x1 = X(z.x1) + cw;
      g += `<rect x="${f(x0)}" y="${T}" width="${f(x1 - x0)}" height="${ph}" class="c-zone ${z.kind || 'note'}"/>`;
      if (z.label) g += text((x0 + x1) / 2, T + 12, z.label, 'c-lbl', 'middle');
    });
    (S.box || []).forEach(b => {
      const x0 = X(b.x0) - cw, x1 = X(b.x1) + cw, y0 = Y(Math.max(b.y0, b.y1)), y1 = Y(Math.min(b.y0, b.y1));
      g += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(Math.max(2, y1 - y0))}" class="c-box"/>`;
      if (b.label) g += text(x0 + 3, y0 - 3, b.label, 'c-lbl');
    });
    (S.ma || []).forEach(m => {
      const a = sma(closes, m.len), e = ema(closes, m.len), idx = [];
      for (let i = 0; i < N; i++) if (a[i] !== null) idx.push(i);
      if (!idx.length) return;
      const top = idx.map(i => `${f(X(i))},${f(Y(a[i]))}`), bot = idx.map(i => `${f(X(i))},${f(Y(e[i]))}`).reverse();
      g += `<polygon points="${top.concat(bot).join(' ')}" class="c-ma-fill"/>`;
      g += `<polyline points="${top.join(' ')}" class="c-ma"/><polyline points="${bot.join(' ')}" class="c-ma"/>`;
      const last = idx[idx.length - 1];
      if (m.label) g += text(X(last) + cw + 4, Y((a[last] + e[last]) / 2) + 4, m.label, 'c-lbl c-ma-lbl');
    });
    (S.hl || []).forEach(h => {
      g += `<line x1="${L}" x2="${L + pw}" y1="${f(Y(h.y))}" y2="${f(Y(h.y))}" class="c-hl${h.dash ? ' dash' : ''}"/>`;
      if (h.label) g += text(L + pw + 4, Y(h.y) + 4, h.label, 'c-lbl');
    });

    if (S.line) {
      g += `<polyline points="${closes.map((p, i) => `${f(X(i))},${f(Y(p))}`).join(' ')}" class="c-line"/>`;
    } else {
      cs.forEach((c, i) => {
        const cls = c.c >= c.o ? 'up' : 'down', x = X(i), yt = Y(Math.max(c.o, c.c)), yb = Y(Math.min(c.o, c.c));
        g += `<line x1="${f(x)}" x2="${f(x)}" y1="${f(Y(c.hi))}" y2="${f(Y(c.lo))}" class="c-wick ${cls}"/>`;
        g += `<rect x="${f(x - cw / 2)}" y="${f(yt)}" width="${f(cw)}" height="${f(Math.max(1, yb - yt))}" class="c-body ${cls}"/>`;
      });
    }

    (S.arrow || []).forEach(a => {
      g += `<line x1="${f(X(a.x0))}" y1="${f(Y(a.y0))}" x2="${f(X(a.x1))}" y2="${f(Y(a.y1))}" class="c-arrow" marker-end="url(#${id}a)"/>`;
      if (a.text) g += text(X(a.x1) + 6, Y(a.y1) + 4, a.text, 'c-lbl');
    });
    (S.mark || []).forEach(m => {
      const k = m.at, i = wp[k], p = S.path[k];
      const peak = (k === 0 || p >= S.path[k - 1]) && (k === S.path.length - 1 || p >= S.path[k + 1]);
      const y = peak ? Y(Math.max(cs[i].hi, p)) - 6 : Y(Math.min(cs[i].lo, p)) + 15;
      g += text(X(i), y, m.text, 'c-mark', 'middle');
    });
    if (S.title) g += text(L, 17, S.title, 'c-title');

    svg.setAttribute('viewBox', `0 0 ${S.w} ${S.h}`);
    svg.setAttribute('role', 'img');
    if (S.title && !svg.getAttribute('aria-label')) svg.setAttribute('aria-label', S.title);
    svg.innerHTML = g;
    return svg;
  };
})();
