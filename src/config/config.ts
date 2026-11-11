import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Rule, Severity } from '../types.ts';

export type FailOn = 'error' | 'warn' | 'none';
export type RuleSetting = Severity | 'off';

export interface UserConfig {
  /** Maximum number of HTML pages to audit. */
  maxPages?: number;
  /** Maximum link depth from the start URL (0 = start page only). */
  maxDepth?: number;
  /** Maximum parallel requests. */
  concurrency?: number;
  /** Per-request timeout in milliseconds. */
  timeout?: number;
  respectRobots?: boolean;
  failOn?: FailOn;
  /** Path globs (`*` within a segment, `**` across segments) that are neither crawled nor checked. */
  ignore?: string[];
  /** Turn rules off or change their severity, keyed by rule id. */
  rules?: Record<string, RuleSetting>;
  /** Extra rules; only available from a .ts/.js config. */
  customRules?: Rule[];
}

export type ResolvedConfig = Required<UserConfig>;

export const DEFAULT_CONFIG: ResolvedConfig = {
  maxPages: 50,
  maxDepth: 5,
  concurrency: 8,
  timeout: 15_000,
  respectRobots: true,
  failOn: 'error',
  ignore: [],
  rules: {},
  customRules: [],
};

const CONFIG_FILES = ['siteaudit.config.json', 'siteaudit.config.ts', 'siteaudit.config.mjs', 'siteaudit.config.js'];

const FAIL_ON: readonly string[] = ['error', 'warn', 'none'];
const RULE_SETTINGS: readonly string[] = ['error', 'warn', 'info', 'off'];

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Identity helper that gives `siteaudit.config.ts` type checking and autocompletion. */
export function defineConfig(config: UserConfig): UserConfig {
  return config;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Validates untrusted config input (file or CLI) and returns it typed. */
export function validateConfig(raw: unknown, source: string): UserConfig {
  const fail = (message: string): never => {
    throw new ConfigError(`${source}: ${message}`);
  };
  if (!isRecord(raw)) return fail('config must be an object');
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case 'maxPages':
      case 'concurrency':
      case 'timeout':
        if (!Number.isInteger(value) || (value as number) < 1) fail(`"${key}" must be a positive integer`);
        break;
      case 'maxDepth':
        if (!Number.isInteger(value) || (value as number) < 0) fail(`"${key}" must be a non-negative integer`);
        break;
      case 'respectRobots':
        if (typeof value !== 'boolean') fail(`"${key}" must be true or false`);
        break;
      case 'failOn':
        if (typeof value !== 'string' || !FAIL_ON.includes(value)) fail(`"failOn" must be one of ${FAIL_ON.join(', ')}`);
        break;
      case 'ignore':
        if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
          fail('"ignore" must be an array of strings');
        }
        break;
      case 'rules':
        if (!isRecord(value)) return fail('"rules" must be an object of rule id to severity');
        for (const [id, setting] of Object.entries(value)) {
          if (typeof setting !== 'string' || !RULE_SETTINGS.includes(setting)) {
            fail(`rule "${id}" must be one of ${RULE_SETTINGS.join(', ')}`);
          }
        }
        break;
      case 'customRules':
        if (
          !Array.isArray(value) ||
          !value.every(
            (rule) =>
              isRecord(rule) &&
              typeof rule.id === 'string' &&
              typeof rule.severity === 'string' &&
              RULE_SETTINGS.includes(rule.severity) &&
              rule.severity !== 'off' &&
              typeof rule.check === 'function',
          )
        ) {
          fail('"customRules" must be an array of rules with an id, a severity and a check() function');
        }
        break;
      default:
        fail(`unknown option "${key}"`);
    }
  }
  return raw;
}

/** Merges config layers; later layers win, `rules` merge per id, `ignore` and `customRules` accumulate. */
export function mergeConfig(...layers: UserConfig[]): ResolvedConfig {
  return layers.reduce<ResolvedConfig>(
    (merged, layer) => ({
      ...merged,
      ...layer,
      ignore: [...merged.ignore, ...(layer.ignore ?? [])],
      rules: { ...merged.rules, ...layer.rules },
      customRules: [...merged.customRules, ...(layer.customRules ?? [])],
    }),
    DEFAULT_CONFIG,
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Loads `explicitPath`, or the first `siteaudit.config.*` in `cwd`. Returns `{}` when there is none. */
export async function loadConfigFile(cwd: string, explicitPath?: string): Promise<UserConfig> {
  let path: string | undefined;
  if (explicitPath !== undefined) {
    path = resolve(cwd, explicitPath);
    if (!(await exists(path))) throw new ConfigError(`Config file not found: ${path}`);
  } else {
    for (const name of CONFIG_FILES) {
      if (await exists(resolve(cwd, name))) {
        path = resolve(cwd, name);
        break;
      }
    }
  }
  if (path === undefined) return {};
  if (path.endsWith('.json')) {
    try {
      return validateConfig(JSON.parse(await readFile(path, 'utf8')), path);
    } catch (error) {
      if (error instanceof SyntaxError) throw new ConfigError(`${path}: invalid JSON (${error.message})`);
      throw error;
    }
  }
  const module = (await import(pathToFileURL(path).href)) as { default?: unknown };
  return validateConfig(module.default, path);
}

/** Applies severity overrides and drops rules that are turned off. Unknown rule ids are an error. */
export function resolveRules(available: readonly Rule[], settings: Record<string, RuleSetting>): Rule[] {
  const ids = new Set(available.map((rule) => rule.id));
  const unknown = Object.keys(settings).filter((id) => !ids.has(id));
  if (unknown.length > 0) throw new ConfigError(`Unknown rule id(s): ${unknown.join(', ')}`);
  return available.flatMap((rule) => {
    const setting = settings[rule.id];
    if (setting === 'off') return [];
    return setting === undefined ? [rule] : [{ ...rule, severity: setting }];
  });
}

const globToSource = (glob: string): string =>
  glob
    .split('**')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*'))
    .join('.*');

/**
 * Compiles `ignore` globs into a predicate on a URL's path: `*` = one segment, `**` = any depth,
 * and a trailing `/**` also matches the bare prefix (`/blog/**` covers `/blog`).
 */
export function compileIgnore(patterns: readonly string[]): (url: string) => boolean {
  if (patterns.length === 0) return () => false;
  const regexes = patterns.map((pattern) =>
    pattern.endsWith('/**')
      ? new RegExp(`^${globToSource(pattern.slice(0, -3))}(?:/.*)?$`)
      : new RegExp(`^${globToSource(pattern)}$`),
  );
  return (url) => {
    const { pathname } = new URL(url);
    return regexes.some((regex) => regex.test(pathname));
  };
}
