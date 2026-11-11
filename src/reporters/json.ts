import type { Report } from '../types.ts';

/** Stable, pretty-printed JSON for CI artifacts and custom tooling. */
export function renderJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
