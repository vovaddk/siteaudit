import type { Rule } from '../types.ts';
import { brokenLink } from './broken-link.ts';
import { buttonName } from './button-name.ts';
import { canonicalMismatch } from './canonical-mismatch.ts';
import { canonicalMissing } from './canonical-missing.ts';
import { favicon } from './favicon.ts';
import { formLabel } from './form-label.ts';
import { h1Single } from './h1-single.ts';
import { headingOrder } from './heading-order.ts';
import { htmlLang } from './html-lang.ts';
import { imageSize } from './image-size.ts';
import { imgAlt } from './img-alt.ts';
import { linkName } from './link-name.ts';
import { metaDescriptionDuplicate } from './meta-description-duplicate.ts';
import { metaDescriptionMissing } from './meta-description-missing.ts';
import { mixedContent } from './mixed-content.ts';
import { noindex } from './noindex.ts';
import { openGraph } from './open-graph.ts';
import { redirectChain } from './redirect-chain.ts';
import { renderBlockingScript } from './render-blocking-script.ts';
import { sitemapCoverage } from './sitemap-coverage.ts';
import { titleDuplicate } from './title-duplicate.ts';
import { titleLength } from './title-length.ts';
import { titleMissing } from './title-missing.ts';
import { viewport } from './viewport.ts';

/** Built-in rules, in the order they are listed in reports. */
export const builtinRules: readonly Rule[] = [
  // SEO
  titleMissing,
  titleLength,
  titleDuplicate,
  metaDescriptionMissing,
  metaDescriptionDuplicate,
  h1Single,
  viewport,
  canonicalMissing,
  canonicalMismatch,
  openGraph,
  noindex,
  sitemapCoverage,
  // Accessibility
  htmlLang,
  headingOrder,
  imgAlt,
  linkName,
  buttonName,
  formLabel,
  // Quality
  brokenLink,
  redirectChain,
  mixedContent,
  imageSize,
  renderBlockingScript,
  favicon,
];
