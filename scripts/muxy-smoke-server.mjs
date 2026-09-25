import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

// Optional disposable worker exercises descendant discovery and tree shutdown.
if (process.argv.includes('--worker')) spawn(process.execPath, ['-e', 'console.log(`Worker PID: ${process.pid}`); setInterval(() => {}, 1000)'], { stdio: 'inherit' });

// Start this through Run Deck to verify the real Muxy terminal and service flow.
// Port 0 allocates a free loopback port; all resources belong to this process.
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(`Run Deck native smoke test\nPID: ${process.pid}\n`);
});

server.listen(0, '127.0.0.1', () => {
  console.log(`Run Deck native smoke test\nPID: ${process.pid}\nURL: http://127.0.0.1:${server.address().port}/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => {
    console.log('Run Deck native smoke test stopped.');
  });
});
