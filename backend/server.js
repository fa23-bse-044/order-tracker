const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const CLIENT = process.env.CLIENT_URL || '*';
const origin = CLIENT === '*' ? '*' : CLIENT.split(',').map((s) => s.trim());
const STATUSES = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const app = express();
app.use(cors({ origin }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin } });

// ---------- In-memory data ----------
const catalog = [
  { id: 1, name: 'Laptop', price: 900 },
  { id: 2, name: 'Smartphone', price: 500 },
  { id: 3, name: 'Headphones', price: 80 },
  { id: 4, name: 'Keyboard', price: 45 },
  { id: 5, name: 'Monitor', price: 220 },
];
let orders = [];
let nextId = 1;
const chats = {}; // orderId -> [{sender,text,time}]
const sseClients = new Set();

const findOrder = (id) => orders.find((o) => o.id === Number(id));
const alertAll = (payload) => {
  const data = `data: ${JSON.stringify({ ...payload, time: Date.now() })}\n\n`;
  sseClients.forEach((res) => res.write(data));
};
const pushStatus = (order) => {
  io.emit('order:status', order); // support dashboard + customers
  io.to(`order:${order.id}`).emit('room:notice', { text: `Order status: ${order.status}` });
};

app.get('/', (_, res) => res.json({ ok: true, service: 'order-tracker' }));

// ---------- 1. REST ----------
app.get('/api/v1/catalog', (_, res) => res.json(catalog));
app.get('/api/v1/orders', (_, res) => res.json(orders));
app.get('/api/v1/orders/:id', (req, res) => {
  const o = findOrder(req.params.id);
  return o ? res.json(o) : res.status(404).json({ error: 'Order not found' });
});
app.post('/api/v1/orders', (req, res) => {
  const product = catalog.find((c) => c.id === Number(req.body.catalogId));
  if (!product) return res.status(400).json({ error: 'Valid catalogId required' });
  const qty = Math.max(1, Number(req.body.quantity) || 1);
  const order = {
    id: nextId++,
    item: product.name,
    quantity: qty,
    total: product.price * qty,
    customer: req.body.customer || 'Guest',
    status: 'PLACED',
    createdAt: Date.now(),
  };
  orders.push(order);
  io.emit('order:created', order);
  alertAll({ type: 'NEW_ORDER', orderId: order.id, message: `New order #${order.id} (${order.item} x${qty})` });
  res.status(201).json(order);
});
app.patch('/api/v1/orders/:id/status', (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!STATUSES.includes(req.body.status))
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  order.status = req.body.status;
  pushStatus(order);
  alertAll({ type: 'STATUS_CHANGED', orderId: order.id, message: `Order #${order.id} is now ${order.status}` });
  res.json(order);
});
app.delete('/api/v1/orders/:id', (req, res) => {
  const before = orders.length;
  orders = orders.filter((o) => o.id !== Number(req.params.id));
  return before === orders.length ? res.status(404).json({ error: 'Order not found' }) : res.status(204).end();
});

// ---------- 3. JSON-RPC 2.0 ----------
const rpcError = (code, message) => ({ code, message });
const rpcMethods = {
  cancelOrder: ({ orderId }) => {
    const o = findOrder(orderId);
    if (!o) throw rpcError(-32001, 'Order not found');
    if (['DELIVERED', 'CANCELLED'].includes(o.status)) throw rpcError(-32002, `Cannot cancel a ${o.status} order`);
    o.status = 'CANCELLED';
    pushStatus(o);
    alertAll({ type: 'ORDER_CANCELLED', orderId: o.id, message: `Order #${o.id} was cancelled` });
    return o;
  },
  getOrderStatus: ({ orderId }) => {
    const o = findOrder(orderId);
    if (!o) throw rpcError(-32001, 'Order not found');
    return { orderId: o.id, status: o.status };
  },
  listOrders: () => orders,
};
const handleRpc = (req) => {
  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string')
    return { jsonrpc: '2.0', error: rpcError(-32600, 'Invalid Request'), id: req?.id ?? null };
  const fn = rpcMethods[req.method];
  if (!fn) return { jsonrpc: '2.0', error: rpcError(-32601, 'Method not found'), id: req.id ?? null };
  try {
    return { jsonrpc: '2.0', result: fn(req.params || {}), id: req.id ?? null };
  } catch (e) {
    return { jsonrpc: '2.0', error: e.code ? e : rpcError(-32603, 'Internal error'), id: req.id ?? null };
  }
};
app.post('/rpc', (req, res) => {
  if (Array.isArray(req.body)) return res.json(req.body.map(handleRpc)); // batch support
  res.json(handleRpc(req.body));
});

// ---------- 4. SSE ----------
app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Live alerts connected', time: Date.now() })}\n\n`);
  sseClients.add(res);
  const beat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(beat); sseClients.delete(res); });
});

// ---------- 2. WebSockets (Socket.io) ----------
io.on('connection', (socket) => {
  socket.on('room:join', (payload = {}, acknowledge) => {
    const order = findOrder(payload.orderId);
    if (!order) return acknowledge?.({ error: 'Order not found. Refresh the order list and try again.' });
    if (!['customer', 'support'].includes(payload.role))
      return acknowledge?.({ error: 'A valid chat role is required.' });

    const room = `order:${order.id}`;
    socket.join(room);
    socket.emit('chat:history', { orderId: order.id, messages: chats[order.id] || [] });
    socket.to(room).emit('room:joined', { role: payload.role, orderId: order.id });
    acknowledge?.({ ok: true, orderId: order.id });
  });
  socket.on('room:leave', ({ orderId }) => socket.leave(`order:${orderId}`));
  socket.on('chat:message', (payload = {}, acknowledge) => {
    const order = findOrder(payload.orderId);
    if (!order) return acknowledge?.({ error: 'Order not found.' });
    const room = `order:${order.id}`;
    if (!socket.rooms.has(room)) return acknowledge?.({ error: 'Join this order chat before sending a message.' });
    if (!['customer', 'support'].includes(payload.sender))
      return acknowledge?.({ error: 'A valid sender role is required.' });
    if (typeof payload.text !== 'string' || !payload.text.trim())
      return acknowledge?.({ error: 'Write a message before sending.' });

    const msg = { orderId: order.id, sender: payload.sender, text: payload.text.trim(), time: Date.now() };
    (chats[order.id] ||= []).push(msg);
    io.to(room).emit('chat:message', msg);
    acknowledge?.({ ok: true });
  });
  socket.on('chat:typing', (payload = {}) => {
    const order = findOrder(payload.orderId);
    if (!order || !socket.rooms.has(`order:${order.id}`)) return;
    socket.to(`order:${order.id}`).emit('chat:typing', { orderId: order.id, sender: payload.sender });
  });
});

server.listen(process.env.PORT || 4000, () => console.log('Server running on', process.env.PORT || 4000));
