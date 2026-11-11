import type { Report } from '../types.ts';
import { siteName } from './format.ts';

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);

/**
 * Self-contained HTML report: data is embedded as JSON and rendered by inline script.
 * Crawled text only ever reaches the DOM through textContent, so hostile pages cannot inject markup.
 */
export function renderHtml(report: Report): string {
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>siteaudit report for ${escapeHtml(siteName(report))}</title>
<style>${STYLE}</style>
</head>
<body>
<noscript><p class="noscript">This report needs JavaScript to render. The raw data is in the page source.</p></noscript>
<div id="app"></div>
<script id="report-data" type="application/json">${data}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const STYLE = String.raw`
:root {
  --paper: #eef1f4; --sheet: #ffffff; --ink: #17202b; --muted: #5a6575; --line: #d6dce4;
  --error: #c42f28; --warn: #9a620c; --info: #2c5fa8; --pass: #23704d;
  --error-wash: #fbeceb; --warn-wash: #fbf2e2; --info-wash: #e9f0fb;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --mono: ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #0f141a; --sheet: #161d26; --ink: #e5e9ef; --muted: #98a3b3; --line: #2a3441;
    --error: #ff7a6e; --warn: #e5ac48; --info: #84aefc; --pass: #5cc993;
    --error-wash: #3a1d1c; --warn-wash: #352a17; --info-wash: #1b2840;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.55 var(--sans); }
button, input, select { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--info); outline-offset: 2px; }
.noscript { padding: 2rem; }
.wrap { max-width: 1240px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 40px); }

/* Masthead: the site under audit is the headline; its pages form the skyline below. */
.masthead { padding-top: 36px; }
.brand { font-weight: 650; letter-spacing: -0.01em; color: var(--muted); font-size: 14px; margin: 0 0 18px; }
.brand b { color: var(--ink); }
.headline { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 32px; }
.headline h1 { margin: 0; font-size: clamp(30px, 5.4vw, 58px); line-height: 1.02; letter-spacing: -0.035em; font-weight: 750; overflow-wrap: anywhere; }
.headline p { margin: 8px 0 0; color: var(--muted); }
.overall { text-align: right; font-variant-numeric: tabular-nums; }
.overall strong { display: block; font-size: clamp(44px, 7vw, 76px); line-height: 0.9; letter-spacing: -0.05em; font-weight: 800; }
.overall span { color: var(--muted); font-size: 14px; }

.skyline { position: relative; display: flex; align-items: flex-end; gap: 4px; height: 132px; margin: 28px 0 0; border-bottom: 2px solid var(--ink); }
.skyline button { flex: 1 1 0; min-width: 3px; border: 0; padding: 0; border-radius: 3px 3px 0 0; cursor: pointer; background: currentColor; opacity: 0.88; transition: opacity .15s, transform .15s; transform-origin: bottom; }
.skyline button:hover, .skyline button[aria-pressed="true"] { opacity: 1; transform: scaleY(1.04); }
.skyline button[aria-pressed="false"].dim { opacity: 0.28; }
.avg { position: absolute; z-index: 1; left: 0; right: 0; border-top: 1.5px dashed var(--ink); pointer-events: none; }
.avg span { position: absolute; right: 0; top: -24px; font-size: 12px; color: var(--ink); background: var(--paper); padding: 1px 6px; border-radius: 4px; }
.skyline-caption { display: flex; justify-content: space-between; color: var(--muted); font-size: 12.5px; margin: 6px 0 0; }
.band-pass { color: var(--pass); --band: var(--pass); } .band-warn { color: var(--warn); --band: var(--warn); } .band-error { color: var(--error); --band: var(--error); }

/* Filters */
.toolbar { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); margin-top: 28px; }
.toolbar .wrap { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-top: 12px; padding-bottom: 12px; }
.toggle { display: inline-flex; align-items: center; gap: 8px; border: 1.5px solid var(--line); background: var(--sheet); border-radius: 999px; padding: 5px 14px 5px 10px; cursor: pointer; font-variant-numeric: tabular-nums; }
.toggle .glyph { font-size: 12px; }
.toggle[aria-pressed="true"] { border-color: currentColor; }
.toggle[aria-pressed="false"] { color: var(--muted); }
.toggle[aria-pressed="false"] .glyph { opacity: .45; }
.toggle.sev-error[aria-pressed="true"] { color: var(--error); background: var(--error-wash); }
.toggle.sev-warn[aria-pressed="true"] { color: var(--warn); background: var(--warn-wash); }
.toggle.sev-info[aria-pressed="true"] { color: var(--info); background: var(--info-wash); }
.toggle b { color: var(--ink); font-weight: 650; }
.spacer { flex: 1 1 24px; }
.field { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }
.field select, .field input { background: var(--sheet); border: 1.5px solid var(--line); border-radius: 8px; padding: 6px 10px; min-width: 0; }
.field input { width: 220px; }
.clear { border: 0; background: none; color: var(--info); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; padding: 4px; }

/* Body */
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 36px; padding-top: 28px; padding-bottom: 64px; align-items: start; }
.pages { display: grid; gap: 14px; }
/* After the band classes: the page keeps ink text and takes only the band colour for its edge and score. */
.page { color: var(--ink); background: var(--sheet); border: 1px solid var(--line); border-left: 5px solid var(--band); border-radius: 4px 10px 10px 4px; }
.page > header { display: flex; align-items: center; gap: 16px; padding: 14px 18px; }
.page h2 { margin: 0; font-size: 16.5px; font-weight: 650; overflow-wrap: anywhere; flex: 1; letter-spacing: -0.01em; }
.page h2 a { color: var(--ink); text-decoration: none; }
.page h2 a:hover { text-decoration: underline; text-underline-offset: 3px; }
.pips { display: flex; gap: 12px; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pips .e { color: var(--error); } .pips .w { color: var(--warn); } .pips .i { color: var(--info); }
.page-score { color: var(--band); font-size: 24px; font-weight: 800; letter-spacing: -0.03em; min-width: 2.2ch; text-align: right; font-variant-numeric: tabular-nums; }
.issues { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.issue { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 4px 12px; padding: 11px 18px; }
.issue + .issue { border-top: 1px dashed var(--line); }
.sev { font-size: 13px; font-weight: 650; padding-top: 1px; }
.sev-error { color: var(--error); } .sev-warn { color: var(--warn); } .sev-info { color: var(--info); }
.msg { margin: 0; }
.rule-link { border: 0; background: none; padding: 0; color: var(--muted); font-size: 13px; cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.rule-link:hover { color: var(--ink); }
.snippet { grid-column: 2; margin: 2px 0 0; font: 12.5px/1.5 var(--mono); background: var(--paper); border-radius: 6px; padding: 6px 9px; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--muted); }
.issue .meta { grid-column: 2; }
.passed { color: var(--pass); margin: 6px 2px 0; font-size: 14px; }
.empty { background: var(--sheet); border: 1.5px dashed var(--line); border-radius: 10px; padding: 32px; text-align: center; color: var(--muted); }

aside h3 { font-size: 15px; margin: 0 0 4px; letter-spacing: -0.01em; }
aside > p { margin: 0 0 14px; color: var(--muted); font-size: 13.5px; }
.rules { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.rules li { border-bottom: 1px solid var(--line); }
.rules button { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; width: 100%; text-align: left; background: none; border: 0; padding: 11px 6px; cursor: pointer; border-radius: 6px; }
.rules button:hover { background: var(--sheet); }
.rules button[aria-pressed="true"] { background: var(--sheet); box-shadow: inset 3px 0 0 var(--info); }
.rules .id { font-weight: 650; font-size: 14px; }
.rules .count { font-variant-numeric: tabular-nums; font-weight: 650; }
.rules .desc { grid-column: 1 / -1; color: var(--muted); font-size: 13px; }
.rules .docs { grid-column: 1 / -1; font-size: 13px; }
.cat { font-size: 12px; color: var(--muted); font-weight: 500; margin-left: 6px; }
details.ok { margin-top: 18px; font-size: 13.5px; color: var(--muted); }
details.ok summary { cursor: pointer; color: var(--pass); }
details.ok ul { padding-left: 18px; margin: 8px 0 0; }
footer { color: var(--muted); font-size: 13px; padding-bottom: 40px; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  aside { order: -1; }
  .field input { width: 100%; }
  .field { flex: 1 1 200px; }
  .overall { text-align: left; }
}
@media (max-width: 560px) {
  .issue { grid-template-columns: 1fr; }
  .snippet, .issue .meta { grid-column: 1; }
  .pips { display: none; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const SCRIPT = String.raw`
(() => {
  const report = JSON.parse(document.getElementById('report-data').textContent);
  const SEVERITIES = ['error', 'warn', 'info'];
  const LABEL = { error: 'Error', warn: 'Warning', info: 'Info' };
  const PLURAL = { error: 'errors', warn: 'warnings', info: 'info' };
  const GLYPH = { error: '✖', warn: '▲', info: '●' };
  const state = { severities: new Set(SEVERITIES), rule: '', query: '', page: '' };
  const rulesById = new Map(report.rules.map((r) => [r.id, r]));

  const h = (tag, props = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === false) continue;
      if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (key === 'class') el.className = value;
      else el.setAttribute(key, value === true ? '' : value);
    }
    el.append(...children.flat().filter((c) => c !== undefined && c !== null && c !== false));
    return el;
  };
  const display = (url) => {
    const u = new URL(url);
    return u.origin === report.origin ? u.pathname + u.search : url;
  };
  const band = (score) => (score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'error');
  const count = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  const visibleIssues = (page) =>
    page.issues.filter((i) => state.severities.has(i.severity) && (!state.rule || i.ruleId === state.rule));
  const pageMatches = (page) =>
    (!state.page || page.url === state.page) &&
    (!state.query || display(page.url).toLowerCase().includes(state.query.toLowerCase()));

  const app = document.getElementById('app');
  const totals = { error: report.summary.errors, warn: report.summary.warnings, info: report.summary.infos };
  const when = new Date(report.startedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  // Local folders are served from 127.0.0.1; name them by the folder instead.
  const host = /^https?:\/\//i.test(report.target) ? new URL(report.origin).host : report.target;

  // Masthead + skyline of page scores (worst pages stand out as short red bars).
  const avg = h('div', { class: 'avg', style: 'bottom:' + report.score + '%' }, h('span', {}, 'Overall ' + report.score));
  const bars = report.pages.map((page) =>
    h('button', {
      class: 'band-' + band(page.score),
      style: 'height:' + Math.max(page.score, 3) + '%',
      title: display(page.url) + ': ' + page.score,
      'aria-label': 'Show only ' + display(page.url) + ', score ' + page.score,
      'aria-pressed': 'false',
      onclick: () => { state.page = state.page === page.url ? '' : page.url; render(); },
    }),
  );
  app.append(
    h('header', { class: 'masthead wrap' },
      h('p', { class: 'brand' }, h('b', {}, 'siteaudit'), ' report'),
      h('div', { class: 'headline' },
        h('div', {},
          h('h1', {}, host),
          h('p', {}, count(report.summary.pages, 'page') + ' audited on ' + when + ', in ' + (report.durationMs / 1000).toFixed(1) + ' s'),
        ),
        h('div', { class: 'overall band-' + band(report.score) }, h('strong', {}, String(report.score)), h('span', {}, 'out of 100')),
      ),
      h('div', { class: 'skyline', role: 'group', 'aria-label': 'Score per page' }, avg, bars),
      h('p', { class: 'skyline-caption' }, h('span', {}, 'Each bar is one page; height is its score'), h('span', {}, 'Select a bar to focus on that page')),
    ),
  );

  // Filters
  const toggles = SEVERITIES.map((sev) =>
    h('button', {
      class: 'toggle sev-' + sev, 'aria-pressed': 'true',
      onclick: () => { state.severities.has(sev) ? state.severities.delete(sev) : state.severities.add(sev); render(); },
    }, h('span', { class: 'glyph', 'aria-hidden': 'true' }, GLYPH[sev]), h('b', {}, String(totals[sev])), ' ' + PLURAL[sev]),
  );
  const ruleSelect = h('select', { id: 'rule', onchange: (e) => { state.rule = e.target.value; render(); } },
    h('option', { value: '' }, 'All rules'),
    report.rules.map((r) => h('option', { value: r.id }, r.id)),
  );
  const search = h('input', { id: 'q', type: 'search', placeholder: '/pricing', autocomplete: 'off',
    oninput: (e) => { state.query = e.target.value; render(); } });
  const clear = h('button', { class: 'clear', onclick: () => {
    SEVERITIES.forEach((s) => state.severities.add(s));
    state.rule = ''; state.query = ''; state.page = '';
    ruleSelect.value = ''; search.value = '';
    render();
  } }, 'Clear filters');
  app.append(h('div', { class: 'toolbar' }, h('div', { class: 'wrap' },
    toggles, h('span', { class: 'spacer' }),
    h('label', { class: 'field', for: 'rule' }, 'Rule', ruleSelect),
    h('label', { class: 'field', for: 'q' }, 'Page', search),
    clear,
  )));

  const list = h('section', { class: 'pages', 'aria-label': 'Pages', 'aria-live': 'polite' });
  const rulesList = h('ul', { class: 'rules' });
  const fired = new Map();
  for (const page of report.pages) for (const i of page.issues) fired.set(i.ruleId, (fired.get(i.ruleId) || 0) + 1);
  const passedRules = report.rules.filter((r) => !fired.has(r.id));
  app.append(h('main', { class: 'wrap layout' }, list, h('aside', {},
    h('h3', {}, 'Rules with findings'),
    h('p', {}, 'Select a rule to see only its issues.'),
    rulesList,
    passedRules.length ? h('details', { class: 'ok' },
      h('summary', {}, count(passedRules.length, 'rule') + ' passed on every page'),
      h('ul', {}, passedRules.map((r) => h('li', {}, r.id + ': ' + r.description))),
    ) : null,
  )));
  app.append(h('footer', { class: 'wrap' }, 'Generated by siteaudit ' + report.tool.version + ' for ' + report.target + '.'));

  const setRule = (id) => { state.rule = state.rule === id ? '' : id; ruleSelect.value = state.rule; render(); };

  function render() {
    toggles.forEach((t, i) => t.setAttribute('aria-pressed', String(state.severities.has(SEVERITIES[i]))));
    bars.forEach((bar, i) => {
      const pressed = state.page === report.pages[i].url;
      bar.setAttribute('aria-pressed', String(pressed));
      bar.classList.toggle('dim', Boolean(state.page) && !pressed);
    });

    const pages = report.pages
      .filter(pageMatches)
      .map((page) => ({ page, issues: visibleIssues(page) }))
      .sort((a, b) => a.page.score - b.page.score);
    const withIssues = pages.filter((p) => p.issues.length > 0);

    const filtered = Boolean(state.rule) || state.severities.size < SEVERITIES.length;
    const cleanPaths = pages.filter((p) => p.issues.length === 0).map((p) => display(p.page.url));
    list.replaceChildren(...[
      ...withIssues.map(({ page, issues }) => {
        const per = (sev) => page.issues.filter((i) => i.severity === sev).length;
        return h('article', { class: 'page band-' + band(page.score) },
          h('header', {},
            h('h2', {}, h('a', { href: page.url, target: '_blank', rel: 'noopener noreferrer' }, display(page.url))),
            h('span', { class: 'pips' },
              per('error') ? h('span', { class: 'e' }, count(per('error'), 'error')) : null,
              per('warn') ? h('span', { class: 'w' }, count(per('warn'), 'warning')) : null,
              per('info') ? h('span', { class: 'i' }, per('info') + ' info') : null,
            ),
            h('span', { class: 'page-score', title: 'Page score' }, String(page.score)),
          ),
          h('ul', { class: 'issues' }, issues.map((issue) => h('li', { class: 'issue' },
            h('span', { class: 'sev sev-' + issue.severity }, GLYPH[issue.severity] + ' ' + LABEL[issue.severity]),
            h('p', { class: 'msg' }, issue.message),
            h('div', { class: 'meta' }, h('button', { class: 'rule-link', title: rulesById.get(issue.ruleId)?.docs, onclick: () => setRule(issue.ruleId) }, issue.ruleId)),
            issue.snippet ? h('code', { class: 'snippet' }, issue.snippet) : null,
          ))),
        );
      }),
      withIssues.length === 0
        ? h('div', { class: 'empty' }, h('p', {}, 'No issues match these filters.'), clear.cloneNode(true))
        : null,
      cleanPaths.length > 0
        ? h('p', { class: 'passed' }, '✔ No ' + (filtered ? 'matching ' : '') + 'issues on ' + cleanPaths.join(', '))
        : null,
    ].filter(Boolean));
    const emptyClear = list.querySelector('.empty .clear');
    if (emptyClear) emptyClear.addEventListener('click', () => clear.click());

    const counts = new Map();
    for (const { issues } of pages) for (const i of issues) counts.set(i.ruleId, (counts.get(i.ruleId) || 0) + 1);
    rulesList.replaceChildren(...[...fired.keys()]
      // Order by total findings so the list does not jump around while filtering.
      .sort((a, b) => fired.get(b) - fired.get(a))
      .map((id) => {
        const r = rulesById.get(id);
        return h('li', {}, h('button', { 'aria-pressed': String(state.rule === id), onclick: () => setRule(id) },
          h('span', { class: 'id' }, h('span', { class: 'sev-' + r.severity, 'aria-hidden': 'true' }, GLYPH[r.severity] + ' '), id, h('span', { class: 'cat' }, r.category)),
          h('span', { class: 'count' }, String(counts.get(id) || 0)),
          h('span', { class: 'desc' }, r.description),
          state.rule === id ? h('span', { class: 'docs' }, r.docs) : null,
        ));
      }));
  }
  render();
})();
`;
