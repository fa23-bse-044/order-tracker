import { io } from 'socket.io-client';

export const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
export const socket = io(API);

export const STATUSES = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

// REST
export const rest = async (path, options = {}) => {
  const res = await fetch(`${API}/api/v1${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// JSON-RPC 2.0
let rpcId = 1;
export const rpc = async (method, params = {}) => {
  const res = await fetch(`${API}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: rpcId++ }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
};
