import { describe, expect, it } from 'vitest';
import { brokenLink } from '../src/rules/broken-link.ts';
import { buttonName } from '../src/rules/button-name.ts';
import { canonicalMismatch } from '../src/rules/canonical-mismatch.ts';
import { canonicalMissing } from '../src/rules/canonical-missing.ts';
import { favicon } from '../src/rules/favicon.ts';
import { formLabel } from '../src/rules/form-label.ts';
import { h1Single } from '../src/rules/h1-single.ts';
import { headingOrder } from '../src/rules/heading-order.ts';
import { htmlLang } from '../src/rules/html-lang.ts';
import { imageSize } from '../src/rules/image-size.ts';
import { imgAlt } from '../src/rules/img-alt.ts';
import { builtinRules } from '../src/rules/index.ts';
import { linkName } from '../src/rules/link-name.ts';
import { metaDescriptionDuplicate } from '../src/rules/meta-description-duplicate.ts';
import { metaDescriptionMissing } from '../src/rules/meta-description-missing.ts';
import { mixedContent } from '../src/rules/mixed-content.ts';
import { noindex } from '../src/rules/noindex.ts';
import { openGraph } from '../src/rules/open-graph.ts';
import { redirectChain } from '../src/rules/redirect-chain.ts';
import { renderBlockingScript } from '../src/rules/render-blocking-script.ts';
import { sitemapCoverage } from '../src/rules/sitemap-coverage.ts';
import { titleDuplicate } from '../src/rules/title-duplicate.ts';
import { titleLength } from '../src/rules/title-length.ts';
import { titleMissing } from '../src/rules/title-missing.ts';
import { viewport } from '../src/rules/viewport.ts';
import { check, doc, ORIGIN, page, record } from './helpers.ts';

/** A page that satisfies every built-in rule. */
const CLEAN_HEAD = `
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acme: landing pages that convert</title>
  <meta name="description" content="Fast, accessible landing pages.">
  <link rel="canonical" href="${ORIGIN}/">
  <meta property="og:title" content="Acme">
  <meta property="og:description" content="Landing pages.">
  <meta property="og:image" content="${ORIGIN}/og.png">
  <link rel="icon" href="/favicon.svg">
  <script src="/app.js" defer></script>`;
const CLEAN_BODY = `
  <h1>Acme</h1><h2>Features</h2><h3>Speed</h3><h2>Pricing</h2>
  <img src="/hero.png" alt="Product screenshot"> <a href="/about">About us</a>
  <button>Start</button> <label>Email <input type="email"></label>`;

describe('built-in rules', () => {
  it('have unique ids and complete metadata', () => {
    const ids = builtinRules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of builtinRules) {
      expect(rule.description).not.toBe('');
      expect(rule.docs).not.toBe('');
    }
  });

  it('all pass on a clean page', () => {
    const clean = page(doc(CLEAN_HEAD, CLEAN_BODY));
    const fetched = new Map([
      [`${ORIGIN}/about`, record(`${ORIGIN}/about`)],
      [`${ORIGIN}/hero.png`, record(`${ORIGIN}/hero.png`, { contentLength: 50_000 })],
    ]);
    const context = { fetched, sitemap: new Set([`${ORIGIN}/`]) };
    for (const rule of builtinRules) expect(check(rule, clean, context), rule.id).toEqual([]);
  });
});

describe('title-missing', () => {
  it('passes with a title', () => {
    expect(check(titleMissing, page(doc('<title>Home</title>')))).toEqual([]);
  });
  it('fails without a title, with an empty title, or with only an SVG title', () => {
    expect(check(titleMissing, page(doc()))).toHaveLength(1);
    expect(check(titleMissing, page(doc('<title>  </title>')))).toHaveLength(1);
    expect(check(titleMissing, page(doc('', '<svg><title>Logo</title></svg>')))).toHaveLength(1);
  });
});

describe('title-length', () => {
  it('passes for 10–60 characters and ignores missing titles', () => {
    expect(check(titleLength, page(doc('<title>Pricing | Acme</title>')))).toEqual([]);
    expect(check(titleLength, page(doc()))).toEqual([]);
  });
  it('fails for short and long titles', () => {
    expect(check(titleLength, page(doc('<title>Home</title>')))[0]?.message).toContain('4 characters');
    expect(check(titleLength, page(doc(`<title>${'x'.repeat(61)}</title>`))))
      .toHaveLength(1);
  });
});

describe('title-duplicate', () => {
  it('passes when titles differ', () => {
    const a = page(doc('<title>A page</title>'), '/a');
    expect(check(titleDuplicate, a, { others: [page(doc('<title>B page</title>'), '/b')] })).toEqual([]);
  });
  it('fails when another page shares the title', () => {
    const a = page(doc('<title>Same</title>'), '/a');
    const findings = check(titleDuplicate, a, { others: [page(doc('<title>Same</title>'), '/b')] });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.snippet).toBe('/b');
  });
});

describe('meta-description-missing', () => {
  it('passes with a description (attribute name is case-insensitive)', () => {
    expect(check(metaDescriptionMissing, page(doc('<meta name="Description" content="Hi">')))).toEqual([]);
  });
  it('fails when missing or empty', () => {
    expect(check(metaDescriptionMissing, page(doc()))).toHaveLength(1);
    expect(check(metaDescriptionMissing, page(doc('<meta name="description" content=" ">')))).toHaveLength(1);
  });
});

describe('meta-description-duplicate', () => {
  const withDescription = (text: string, path: string) =>
    page(doc(`<meta name="description" content="${text}">`), path);
  it('passes when descriptions differ or are missing', () => {
    expect(check(metaDescriptionDuplicate, withDescription('One', '/a'), { others: [withDescription('Two', '/b')] })).toEqual([]);
    expect(check(metaDescriptionDuplicate, page(doc(), '/a'), { others: [page(doc(), '/b')] })).toEqual([]);
  });
  it('fails when another page shares the description', () => {
    expect(check(metaDescriptionDuplicate, withDescription('Same', '/a'), { others: [withDescription('Same', '/b')] }))
      .toHaveLength(1);
  });
});

describe('html-lang', () => {
  it('passes with lang', () => {
    expect(check(htmlLang, page(doc()))).toEqual([]);
  });
  it('fails without lang or with an empty one', () => {
    expect(check(htmlLang, page(doc('', '', { lang: null })))).toHaveLength(1);
    expect(check(htmlLang, page(doc('', '', { lang: '' })))).toHaveLength(1);
  });
});

describe('viewport', () => {
  it('passes with a responsive viewport', () => {
    expect(check(viewport, page(doc('<meta name="viewport" content="width=device-width">')))).toEqual([]);
  });
  it('fails when missing or not responsive', () => {
    expect(check(viewport, page(doc()))).toHaveLength(1);
    expect(check(viewport, page(doc('<meta name="viewport" content="initial-scale=1">')))).toHaveLength(1);
  });
});

describe('h1-single', () => {
  it('passes with exactly one h1', () => {
    expect(check(h1Single, page(doc('', '<h1>Hi</h1>')))).toEqual([]);
  });
  it('fails with none or several', () => {
    expect(check(h1Single, page(doc()))[0]?.message).toBe('Page has no <h1>');
    expect(check(h1Single, page(doc('', '<h1>A</h1><h1>B</h1>')))[0]?.message).toBe('Page has 2 <h1> elements');
  });
});

describe('heading-order', () => {
  it('passes for sequential levels and when going back up', () => {
    expect(check(headingOrder, page(doc('', '<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2><h3>e</h3>')))).toEqual([]);
  });
  it('fails when a level is skipped', () => {
    const findings = check(headingOrder, page(doc('', '<h1>a</h1><h3>b</h3><h4>c</h4><h6>d</h6>')));
    expect(findings.map((finding) => finding.message)).toEqual([
      'Heading level skipped: <h1> is followed by <h3>',
      'Heading level skipped: <h4> is followed by <h6>',
    ]);
  });
});

describe('img-alt', () => {
  it('passes with alt text, empty alt, or hidden images', () => {
    const body = '<img src="a.png" alt="A"><img src="b.png" alt=""><img src="c.png" aria-hidden="true"><img src="d.png" role="presentation">';
    expect(check(imgAlt, page(doc('', body)))).toEqual([]);
  });
  it('fails for each image without alt', () => {
    const findings = check(imgAlt, page(doc('', '<img src="a.png"><img src="b.png">')));
    expect(findings).toHaveLength(2);
    expect(findings[0]?.snippet).toBe('<img src="a.png">');
  });
});

describe('link-name', () => {
  it('passes for text, aria-label, aria-labelledby, image alt and title', () => {
    const body = `
      <a href="/a">About</a>
      <a href="/b" aria-label="Twitter"><svg></svg></a>
      <span id="lbl">Docs</span><a href="/c" aria-labelledby="lbl"><svg></svg></a>
      <a href="/d"><img src="x.png" alt="Home"></a>
      <a href="/e" title="Settings"><svg></svg></a>`;
    expect(check(linkName, page(doc('', body)))).toEqual([]);
  });
  it('fails for icon-only links and links whose only text is aria-hidden', () => {
    const body = '<a href="/a"><svg></svg></a><a href="/b"><span aria-hidden="true">→</span></a><a href="/c"><img src="x.png" alt=""></a>';
    expect(check(linkName, page(doc('', body)))).toHaveLength(3);
  });
});

describe('button-name', () => {
  it('passes for named buttons', () => {
    const body = '<button>Save</button><button aria-label="Close">×</button><input type="button" value="Go"><div role="button">Menu</div>';
    expect(check(buttonName, page(doc('', body)))).toEqual([]);
  });
  it('fails for unnamed buttons', () => {
    const body = '<button><svg></svg></button><input type="button"><div role="button"></div>';
    expect(check(buttonName, page(doc('', body)))).toHaveLength(3);
  });
});

describe('form-label', () => {
  it('passes for labelled and self-labelled controls', () => {
    const body = `
      <label for="e">Email</label><input id="e" type="email">
      <label>Name <input name="name"></label>
      <textarea aria-label="Message"></textarea>
      <select title="Country"></select>
      <input type="hidden" name="token"><input type="submit" value="Send">`;
    expect(check(formLabel, page(doc('', body)))).toEqual([]);
  });
  it('fails for controls with only a placeholder or no label at all', () => {
    const body = '<input type="email" placeholder="Email"><textarea></textarea><select></select><label for="other">X</label><input id="mine">';
    expect(check(formLabel, page(doc('', body)))).toHaveLength(4);
  });
});

describe('canonical-missing', () => {
  it('passes with a canonical link', () => {
    expect(check(canonicalMissing, page(doc('<link rel="canonical" href="/">')))).toEqual([]);
  });
  it('fails without one or with an empty href', () => {
    expect(check(canonicalMissing, page(doc()))).toHaveLength(1);
    expect(check(canonicalMissing, page(doc('<link rel="canonical" href="">')))).toHaveLength(1);
  });
});

describe('canonical-mismatch', () => {
  const withCanonical = (href: string, path: string) => page(doc(`<link rel="canonical" href="${href}">`), path);
  it('passes when the canonical is the page itself, ignoring a trailing slash', () => {
    expect(check(canonicalMismatch, withCanonical('/pricing', '/pricing'))).toEqual([]);
    expect(check(canonicalMismatch, withCanonical(`${ORIGIN}/pricing/`, '/pricing'))).toEqual([]);
    expect(check(canonicalMismatch, page(doc(), '/pricing'))).toEqual([]);
  });
  it('fails when the canonical points at another page', () => {
    const findings = check(canonicalMismatch, withCanonical('/', '/pricing'));
    expect(findings[0]?.message).toBe('Canonical points to /, not to this page');
  });
  it('fails for the same path on another host when crawling a live site', () => {
    const findings = check(canonicalMismatch, withCanonical('https://staging.site.test/pricing', '/pricing'));
    expect(findings[0]?.message).toBe('Canonical points to https://staging.site.test/pricing, not to this page');
  });
  it('compares paths only for local folders, which declare the production domain', () => {
    expect(check(canonicalMismatch, withCanonical('https://prod.example/pricing', '/pricing'), { local: true })).toEqual([]);
    expect(check(canonicalMismatch, withCanonical('https://prod.example/', '/pricing'), { local: true })).toHaveLength(1);
  });
});

describe('open-graph', () => {
  it('passes with title, description and image', () => {
    const head = '<meta property="og:title" content="a"><meta property="og:description" content="b"><meta property="og:image" content="c.png">';
    expect(check(openGraph, page(doc(head)))).toEqual([]);
  });
  it('lists the missing tags', () => {
    expect(check(openGraph, page(doc('<meta property="og:title" content="a">')))[0]?.message).toBe(
      'Missing Open Graph tags: og:description, og:image',
    );
  });
});

describe('noindex', () => {
  it('passes for indexable pages', () => {
    expect(check(noindex, page(doc('<meta name="robots" content="index, follow">')))).toEqual([]);
  });
  it('fails for meta robots or X-Robots-Tag noindex', () => {
    expect(check(noindex, page(doc('<meta name="robots" content="noindex">')))).toHaveLength(1);
    expect(check(noindex, page(doc('<meta name="googlebot" content="NOINDEX">')))).toHaveLength(1);
    expect(check(noindex, page(doc(), '/', { 'x-robots-tag': 'noindex, nofollow' }))[0]?.message).toContain('X-Robots-Tag');
  });
});

describe('sitemap-coverage', () => {
  it('passes when listed, or when the site has no sitemap', () => {
    expect(check(sitemapCoverage, page(doc(), '/a'), { sitemap: new Set([`${ORIGIN}/a`]) })).toEqual([]);
    expect(check(sitemapCoverage, page(doc(), '/a'))).toEqual([]);
  });
  it('fails when the sitemap does not list the page', () => {
    expect(check(sitemapCoverage, page(doc(), '/a'), { sitemap: new Set([`${ORIGIN}/`]) })).toHaveLength(1);
  });
});

describe('broken-link', () => {
  const links = page(doc('', '<a href="/ok">ok</a><a href="/gone">gone</a><a href="/down">down</a><a href="https://other.test/x">x</a>'));
  it('passes when internal targets resolve; external links are not checked', () => {
    const fetched = new Map([[`${ORIGIN}/ok`, record(`${ORIGIN}/ok`)]]);
    expect(check(brokenLink, page(doc('', '<a href="/ok">ok</a><a href="https://other.test/x">x</a>')), { fetched })).toEqual([]);
  });
  it('fails for 4xx/5xx and network errors', () => {
    const fetched = new Map([
      [`${ORIGIN}/ok`, record(`${ORIGIN}/ok`)],
      [`${ORIGIN}/gone`, record(`${ORIGIN}/gone`, { status: 404 })],
      [`${ORIGIN}/down`, record(`${ORIGIN}/down`, { status: 0, error: 'ECONNRESET' })],
      ['https://other.test/x', record('https://other.test/x', { status: 500 })],
    ]);
    expect(check(brokenLink, links, { fetched }).map((finding) => finding.message)).toEqual([
      'Broken link to /gone (HTTP 404)',
      'Broken link to /down (ECONNRESET)',
    ]);
  });
});

describe('redirect-chain', () => {
  const linking = page(doc('', '<a href="/old">old</a>'));
  it('passes for a single redirect', () => {
    const fetched = new Map([[`${ORIGIN}/old`, record(`${ORIGIN}/old`, { redirects: [`${ORIGIN}/old`], finalUrl: `${ORIGIN}/new` })]]);
    expect(check(redirectChain, linking, { fetched })).toEqual([]);
  });
  it('fails for two or more hops', () => {
    const fetched = new Map([
      [`${ORIGIN}/old`, record(`${ORIGIN}/old`, { redirects: [`${ORIGIN}/old`, `${ORIGIN}/mid`], finalUrl: `${ORIGIN}/new` })],
    ]);
    const findings = check(redirectChain, linking, { fetched });
    expect(findings[0]?.snippet).toBe('/old → /mid → /new');
  });
});

describe('mixed-content', () => {
  it('passes on https pages with https resources, and ignores http pages and plain links', () => {
    const body = '<img src="https://cdn.test/a.png" alt=""><a href="http://other.test/">plain link</a>';
    expect(check(mixedContent, page(doc('', body)))).toEqual([]);
    const httpPage = { ...page(doc('', '<img src="http://cdn.test/a.png" alt="">')), url: 'http://site.test/' };
    expect(check(mixedContent, httpPage)).toEqual([]);
  });
  it('fails for http subresources on https pages', () => {
    const head = '<link rel="stylesheet" href="http://cdn.test/a.css"><script src="http://cdn.test/a.js" defer></script>';
    const body = '<img src="/a.png" srcset="/a.png 1x, http://cdn.test/a2.png 2x" alt=""><iframe src="http://video.test/"></iframe>';
    const messages = check(mixedContent, page(doc(head, body))).map((finding) => finding.message);
    expect(messages).toEqual([
      'Insecure <script> loaded over http://',
      'Insecure <iframe> loaded over http://',
      'Insecure <img> loaded over http://',
      'Insecure <link> loaded over http://',
    ]);
  });
});

describe('image-size', () => {
  const images = page(doc('', '<img src="/small.png" alt=""><img src="/big.png" alt=""><img src="https://cdn.test/huge.jpg" alt="">'));
  it('passes for small or unknown sizes', () => {
    const fetched = new Map([[`${ORIGIN}/small.png`, record(`${ORIGIN}/small.png`, { contentLength: 1000 })]]);
    expect(check(imageSize, images, { fetched })).toEqual([]);
  });
  it('fails for images over 200 KB', () => {
    const fetched = new Map([
      [`${ORIGIN}/big.png`, record(`${ORIGIN}/big.png`, { contentLength: 300 * 1024 })],
      ['https://cdn.test/huge.jpg', record('https://cdn.test/huge.jpg', { contentLength: 1024 * 1024 })],
    ]);
    expect(check(imageSize, images, { fetched }).map((finding) => finding.message)).toEqual([
      'Image /big.png is 300 KB (limit 200 KB)',
      'Image https://cdn.test/huge.jpg is 1024 KB (limit 200 KB)',
    ]);
  });
});

describe('render-blocking-script', () => {
  it('passes for deferred, async, module, inline and body scripts', () => {
    const head = '<script src="a.js" defer></script><script src="b.js" async></script><script type="module" src="c.js"></script><script>1</script>';
    expect(check(renderBlockingScript, page(doc(head, '<script src="d.js"></script>')))).toEqual([]);
  });
  it('fails for a classic external script in head', () => {
    expect(check(renderBlockingScript, page(doc('<script src="/app.js"></script>')))).toHaveLength(1);
  });
});

describe('favicon', () => {
  it('passes with <link rel="icon">, "shortcut icon", or a working /favicon.ico', () => {
    expect(check(favicon, page(doc('<link rel="icon" href="/f.svg">')))).toEqual([]);
    expect(check(favicon, page(doc('<link rel="shortcut icon" href="/f.ico">')))).toEqual([]);
    const fetched = new Map([[`${ORIGIN}/favicon.ico`, record(`${ORIGIN}/favicon.ico`)]]);
    expect(check(favicon, page(doc()), { fetched })).toEqual([]);
  });
  it('fails when neither exists', () => {
    const fetched = new Map([[`${ORIGIN}/favicon.ico`, record(`${ORIGIN}/favicon.ico`, { status: 404 })]]);
    expect(check(favicon, page(doc()), { fetched })).toHaveLength(1);
  });
});
