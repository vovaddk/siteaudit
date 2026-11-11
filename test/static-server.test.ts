import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveFolder, type StaticServer } from '../src/crawler/static-server.ts';

const DEMO = fileURLToPath(new URL('../examples/demo-site', import.meta.url));
let server: StaticServer;

beforeAll(async () => {
  server = await serveFolder(DEMO);
});
afterAll(async () => {
  await server.close();
});

const get = (path: string): Promise<Response> => fetch(new URL(path, server.url));

describe('serveFolder', () => {
  it('serves index.html, extensionless .html paths and folder indexes', async () => {
    for (const path of ['/', '/about', '/about.html', '/blog/', '/blog']) {
      const response = await get(path);
      expect(response.status, path).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    }
  });

  it('serves assets with their content type and length', async () => {
    const response = await get('/assets/favicon.svg');
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    expect(Number(response.headers.get('content-length'))).toBeGreaterThan(0);
  });

  it('answers unknown paths with 404.html and a 404 status', async () => {
    const response = await get('/nope');
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('Page not found');
  });

  it('refuses to serve files outside the folder', async () => {
    const response = await get('/..%2F..%2Fpackage.json');
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('"name"');
  });
});
