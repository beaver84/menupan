export function createSseHub() {
  const clients = new Set();

  return {
    get size() {
      return clients.size;
    },

    connect(req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
    },

    broadcast(eventName) {
      for (const res of clients) {
        res.write(`event: ${eventName}\ndata: {}\n\n`);
      }
    },
  };
}
