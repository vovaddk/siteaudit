import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

export interface StaticServer {
  url: string;
  close(): Promise<void>;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Maps a URL path to a file the way static hosts do: exact file, `.html`, then `index.html`. */
async function findFile(root: string, pathname: string): Promise<string | undefined> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const base = resolve(join(root, decoded));
  // Never serve anything outside the root folder.
  if (base !== root && !base.startsWith(root + sep)) return undefined;
  const candidates = base === root ? [join(root, 'index.html')] : [base, `${base}.html`, join(base, 'index.html')];
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return undefined;
}

/** Serves `folder` on 127.0.0.1 with a random free port. Unknown paths get `404.html` if present. */
export async function serveFolder(folder: string): Promise<StaticServer> {
  const root = resolve(folder);
  const server: Server = createServer((request, response) => {
    void (async () => {
      const { pathname } = new URL(request.url ?? '/', 'http://localhost');
      const file = await findFile(root, pathname);
      const notFound = join(root, '404.html');
      const target = file ?? ((await isFile(notFound)) ? notFound : undefined);
      if (target === undefined) {
        response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
        return;
      }
      const { size } = await stat(target);
      response.writeHead(file === undefined ? 404 : 200, {
        'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
        'content-length': size,
      });
      if (request.method === 'HEAD') response.end();
      // pipeline() destroys both streams on a read error instead of crashing the process.
      else pipeline(createReadStream(target), response, () => undefined);
    })().catch(() => {
      response.writeHead(500).end();
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/`,
    close: () =>
      new Promise((done) => {
        server.closeAllConnections();
        server.close(() => {
          done();
        });
      }),
  };
}
