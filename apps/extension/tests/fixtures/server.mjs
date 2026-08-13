import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = 4173;
const fixturePath = fileURLToPath(new URL('./vertical-slice.html', import.meta.url));

const server = createServer((request, response) => {
  if (request.url !== '/' && request.url !== '/vertical-slice.html') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': 'text/html; charset=utf-8',
  });
  createReadStream(fixturePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Extension test fixture: http://${host}:${port}/`);
});
