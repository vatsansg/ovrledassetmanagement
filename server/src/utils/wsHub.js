let wss = null;

export function attachWss(server) {
  wss = server;
}

export function broadcast(type, payload) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(message);
  }
}
