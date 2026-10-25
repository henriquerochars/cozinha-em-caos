import os from 'node:os';
import { createGameServer } from './createServer';

const port = Number(process.env.PORT ?? 2567);
const server = createGameServer();

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

await server.listen(port);

console.log('');
console.log('🍳  Cozinha em Caos — servidor multiplayer rodando');
console.log(`    local:   ws://localhost:${port}`);
for (const ip of lanAddresses()) console.log(`    rede:    ws://${ip}:${port}   (use este no celular)`);
console.log('');
