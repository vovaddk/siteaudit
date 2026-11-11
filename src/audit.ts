import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileIgnore, resolveRules, type ResolvedConfig } from './config/config.ts';
import { crawl } from './crawler/crawler.ts';
import { serveFolder, type StaticServer } from './crawler/static-server.ts';
import { overallScore, runRules, summarize } from './engine.ts';
import { builtinRules } from './rules/index.ts';
import type { Page, Report } from './types.ts';
import { USER_AGENT, VERSION } from './version.ts';

export interface AuditHooks {
  /** Called for every crawled page, e.g. to show progress. */
  onPage?: (page: Page) => void;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Crawls `target` (URL, bare domain or local folder), runs the configured rules and builds a report. */
export async function audit(target: string, config: ResolvedConfig, hooks: AuditHooks = {}): Promise<Report> {
  const rules = resolveRules([...builtinRules, ...config.customRules], config.rules);
  const startedAt = new Date();
  let server: StaticServer | undefined;
  let startUrl = target;
  if (!/^https?:\/\//i.test(target)) {
    if (await isDirectory(target)) {
      server = await serveFolder(resolve(target));
      startUrl = server.url;
    } else if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(target)) {
      startUrl = `https://${target}`;
    } else {
      throw new Error(`"${target}" is neither an http(s) URL nor an existing folder`);
    }
  }

  try {
    const site = await crawl(startUrl, {
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
      concurrency: config.concurrency,
      timeoutMs: config.timeout,
      respectRobots: config.respectRobots,
      userAgent: USER_AGENT,
      isIgnored: compileIgnore(config.ignore),
      local: server !== undefined,
      ...(hooks.onPage ? { onPage: hooks.onPage } : {}),
    });
    if (site.pages.length === 0) {
      const start = [...site.fetched.values()][0];
      const reason = start?.error ?? (start ? `HTTP ${String(start.status)}, ${start.contentType ?? 'no content type'}` : 'no response');
      throw new Error(`No HTML page could be fetched from ${startUrl} (${reason})`);
    }
    const pages = runRules(site, rules);
    return {
      tool: { name: 'siteaudit', version: VERSION },
      target,
      origin: site.origin,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      score: overallScore(pages),
      summary: summarize(pages),
      rules: rules.map(({ id, severity, category, description, docs }) => ({ id, severity, category, description, docs })),
      pages,
    };
  } finally {
    await server?.close();
  }
}
