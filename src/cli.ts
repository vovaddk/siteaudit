#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';
import pc from 'picocolors';
import { audit } from './audit.ts';
import {
  DEFAULT_CONFIG,
  loadConfigFile,
  mergeConfig,
  resolveRules,
  validateConfig,
  type ResolvedConfig,
  type UserConfig,
} from './config/config.ts';
import { exitCodeFor } from './engine.ts';
import { renderHtml } from './reporters/html.ts';
import { renderJson } from './reporters/json.ts';
import { renderTerminal } from './reporters/terminal.ts';
import { builtinRules } from './rules/index.ts';
import { VERSION } from './version.ts';

interface CliOptions {
  maxPages?: number;
  maxDepth?: number;
  concurrency?: number;
  timeout?: number;
  ignoreRobots?: true;
  failOn?: UserConfig['failOn'];
  ignore?: string[];
  rule?: Record<string, string>;
  json?: string;
  html?: string;
  config?: string;
  color: boolean;
  listRules?: true;
}

const integer =
  (min: number) =>
  (value: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min) throw new InvalidArgumentError(`Expected an integer >= ${String(min)}.`);
    return parsed;
  };
const collect = (value: string, previous: string[] | undefined): string[] => [...(previous ?? []), value];
const collectRule = (value: string, previous: Record<string, string> | undefined): Record<string, string> => {
  const [id, level] = value.split('=');
  if (id === undefined || id === '' || level === undefined) throw new InvalidArgumentError('Expected <rule-id>=<error|warn|info|off>.');
  return { ...previous, [id]: level };
};

/** Turns parsed flags into a config layer, leaving out everything that was not passed. */
function flagsToConfig(options: CliOptions): UserConfig {
  const layer: Record<string, unknown> = {
    maxPages: options.maxPages,
    maxDepth: options.maxDepth,
    concurrency: options.concurrency,
    timeout: options.timeout,
    respectRobots: options.ignoreRobots === true ? false : undefined,
    failOn: options.failOn,
    ignore: options.ignore,
    rules: options.rule,
  };
  return validateConfig(Object.fromEntries(Object.entries(layer).filter(([, value]) => value !== undefined)), 'command line');
}

async function writeOutput(path: string, content: string): Promise<string> {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, 'utf8');
  return relative(process.cwd(), absolute) || absolute;
}

function listRules(config: ResolvedConfig): string {
  const rules = resolveRules([...builtinRules, ...config.customRules], config.rules);
  const width = Math.max(...rules.map((rule) => rule.id.length));
  return rules.map((rule) => `${rule.id.padEnd(width)}  ${rule.severity.padEnd(5)}  ${rule.category.padEnd(7)}  ${rule.description}`).join('\n');
}

async function run(target: string | undefined, options: CliOptions): Promise<number> {
  // picocolors always reports color support on Windows; also require a terminal (or CI, which renders ANSI).
  const color = options.color && pc.isColorSupported && (process.stdout.isTTY || 'CI' in process.env || 'FORCE_COLOR' in process.env);
  const fileConfig = await loadConfigFile(process.cwd(), options.config);
  const config = mergeConfig(fileConfig, flagsToConfig(options));
  if (options.listRules === true) {
    console.log(listRules(config));
    return 0;
  }
  if (target === undefined) throw new Error('missing <target>: a URL, domain or local folder. See --help.');

  const progress = process.stderr.isTTY;
  let crawled = 0;
  const report = await audit(target, config, {
    onPage: () => {
      crawled++;
      if (progress) process.stderr.write(`\r${pc.dim(`Crawling… ${String(crawled)} page(s)`)}`);
    },
  });
  if (progress) process.stderr.write('\r\x1b[2K');

  console.log(renderTerminal(report, { color }));
  if (options.json !== undefined) console.log(`JSON report: ${await writeOutput(options.json, renderJson(report))}`);
  if (options.html !== undefined) console.log(`HTML report: ${await writeOutput(options.html, renderHtml(report))}`);
  return exitCodeFor(report.summary, config.failOn);
}

const program = new Command('siteaudit')
  .description('Crawl a website or a local build folder and report SEO, accessibility and quality issues.')
  .version(VERSION)
  .argument('[target]', 'URL (https://example.com), bare domain or local folder (./dist)')
  .option('-p, --max-pages <n>', `maximum pages to audit (default: ${String(DEFAULT_CONFIG.maxPages)})`, integer(1))
  .option('-d, --max-depth <n>', `maximum link depth, 0 = start page only (default: ${String(DEFAULT_CONFIG.maxDepth)})`, integer(0))
  .option('-c, --concurrency <n>', `parallel requests (default: ${String(DEFAULT_CONFIG.concurrency)})`, integer(1))
  .option('--timeout <ms>', `per-request timeout (default: ${String(DEFAULT_CONFIG.timeout)})`, integer(1))
  .option('--ignore <glob>', 'skip URLs whose path matches, e.g. "/blog/**" (repeatable)', collect)
  .option('--rule <id=level>', 'set a rule to error, warn, info or off (repeatable)', collectRule)
  .option('--ignore-robots', 'crawl pages disallowed by robots.txt')
  .addOption(new Option('--fail-on <level>', 'exit with code 1 at this severity (default: error)').choices(['error', 'warn', 'none']))
  .option('--json <file>', 'write a JSON report')
  .option('--html <file>', 'write a self-contained HTML report')
  .option('--config <file>', 'config file (default: siteaudit.config.{json,ts,mjs,js} in the working directory)')
  .option('--no-color', 'disable colored output')
  .option('--list-rules', 'print the active rules and exit')
  .showHelpAfterError()
  .exitOverride()
  .action(async (target: string | undefined, options: CliOptions) => {
    process.exitCode = await run(target, options);
  });

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError) {
    // Commander already printed help, the version or the usage error.
    process.exitCode = error.exitCode === 0 ? 0 : 2;
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(process.stderr.isTTY ? pc.red(`siteaudit: ${message}`) : `siteaudit: ${message}`);
    if (error instanceof Error && error.cause !== undefined) console.error(error.cause);
    process.exitCode = 2;
  }
}
