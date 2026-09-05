let socket = null;
const subscribers = new Set();

function ensureSocket() {
  if (socket && socket.readyState <= 1) return socket;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
  socket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(event.data);
      subscribers.forEach((fn) => fn(parsed));
    } catch {
      // ignore non-JSON messages
    }
  });
  return socket;
}

export function subscribeToWs(handler) {
  ensureSocket();
  subscribers.add(handler);
  return () => subscribers.delete(handler);
}
