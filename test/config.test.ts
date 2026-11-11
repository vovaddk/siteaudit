import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  compileIgnore,
  ConfigError,
  DEFAULT_CONFIG,
  loadConfigFile,
  mergeConfig,
  resolveRules,
  validateConfig,
} from '../src/config/config.ts';
import { builtinRules } from '../src/rules/index.ts';

const FIXTURES = fileURLToPath(new URL('./fixtures/config', import.meta.url));

describe('mergeConfig', () => {
  it('starts from defaults', () => {
    expect(mergeConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('lets later layers win, merges rules per id and accumulates ignore patterns', () => {
    const merged = mergeConfig(
      { maxPages: 10, failOn: 'warn', ignore: ['/a/**'], rules: { 'open-graph': 'off', 'title-length': 'info' } },
      { maxPages: 3, ignore: ['/b'], rules: { 'title-length': 'error' } },
    );
    expect(merged.maxPages).toBe(3);
    expect(merged.failOn).toBe('warn');
    expect(merged.maxDepth).toBe(DEFAULT_CONFIG.maxDepth);
    expect(merged.ignore).toEqual(['/a/**', '/b']);
    expect(merged.rules).toEqual({ 'open-graph': 'off', 'title-length': 'error' });
  });
});

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    const config = { maxPages: 5, maxDepth: 0, respectRobots: false, failOn: 'none', ignore: ['/x'], rules: { favicon: 'off' } };
    expect(validateConfig(config, 'test')).toEqual(config);
  });

  it.each([
    [[], 'config must be an object'],
    [{ maxPages: 0 }, '"maxPages" must be a positive integer'],
    [{ maxDepth: -1 }, '"maxDepth" must be a non-negative integer'],
    [{ failOn: 'sometimes' }, '"failOn" must be one of'],
    [{ ignore: '/x' }, '"ignore" must be an array of strings'],
    [{ rules: { favicon: 'loud' } }, 'rule "favicon" must be one of'],
    [{ customRules: [{ id: 'x' }] }, '"customRules" must be an array'],
    [{ maxPagez: 3 }, 'unknown option "maxPagez"'],
  ])('rejects %j', (raw, message) => {
    expect(() => validateConfig(raw, 'test')).toThrow(message);
  });
});

describe('resolveRules', () => {
  it('drops rules that are off and overrides severities', () => {
    const rules = resolveRules(builtinRules, { favicon: 'off', 'title-length': 'error' });
    expect(rules.find((rule) => rule.id === 'favicon')).toBeUndefined();
    expect(rules.find((rule) => rule.id === 'title-length')?.severity).toBe('error');
    expect(rules).toHaveLength(builtinRules.length - 1);
  });

  it('rejects unknown rule ids', () => {
    expect(() => resolveRules(builtinRules, { 'no-such-rule': 'off' })).toThrow(ConfigError);
  });
});

describe('compileIgnore', () => {
  const ignored = compileIgnore(['/blog/**', '/tag/*', '/exact.html']);
  it.each([
    ['https://x.test/blog/2026/post', true],
    ['https://x.test/blog/', true],
    ['https://x.test/blog', true],
    ['https://x.test/blogroll', false],
    ['https://x.test/tag/news', true],
    ['https://x.test/tag/news/page/2', false],
    ['https://x.test/exact.html', true],
    ['https://x.test/exactxhtml', false],
    ['https://x.test/about', false],
  ])('%s -> %s', (url, expected) => {
    expect(ignored(url)).toBe(expected);
  });
});

describe('loadConfigFile', () => {
  it('finds siteaudit.config.json in the working directory', async () => {
    expect(await loadConfigFile(`${FIXTURES}/json`)).toEqual({ maxPages: 7, rules: { 'open-graph': 'off' } });
  });

  it('loads a TypeScript config with custom rules', async () => {
    const config = await loadConfigFile(`${FIXTURES}/ts`);
    expect(config.customRules?.map((rule) => rule.id)).toEqual(['no-lorem-ipsum']);
  });

  it('returns an empty layer when there is no config file', async () => {
    expect(await loadConfigFile(FIXTURES)).toEqual({});
  });

  it('reports a missing explicit path and invalid JSON', async () => {
    await expect(loadConfigFile(FIXTURES, 'nope.json')).rejects.toThrow('Config file not found');
    await expect(loadConfigFile(FIXTURES, 'broken.json')).rejects.toThrow('invalid JSON');
  });
});
