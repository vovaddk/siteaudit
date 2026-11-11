import { readFileSync } from 'node:fs';

// Works from both src/ and dist/: package.json sits one level up in either case.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

export const VERSION = pkg.version;
export const USER_AGENT = `siteaudit/${VERSION} (+https://github.com/vovaddk/siteaudit)`;
