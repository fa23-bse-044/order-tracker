# CSC337 - Lab Assignment 04: Real-Time Order Tracker & Live Support System

A full-stack app demonstrating **REST, WebSockets (Socket.io), JSON-RPC 2.0 and Server-Sent Events** together.

- **Frontend:** React + Vite (deployed on Vercel/Netlify)
- **Backend:** Node.js + Express + Socket.io (deployed on Render/Railway)

## Live URLs
- Frontend: `https://YOUR-APP.vercel.app`
- Backend: `https://YOUR-API.onrender.com`

## Local Setup
```bash
# Backend
cd backend
cp .env.example .env
npm install
npm start            # http://localhost:4000

# Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```
Open two browser tabs: one on **Customer**, one on **Support Agent**.

## Environment Variables
| Where | Variable | Example |
|---|---|---|
| Backend | `PORT` | `4000` (Render sets it automatically) |
| Backend | `CLIENT_URL` | `https://YOUR-APP.vercel.app` (comma-separate multiple) |
| Frontend | `VITE_API_URL` | `https://YOUR-API.onrender.com` |

## 1. REST API (`/api/v1`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/catalog` | List products |
| GET | `/api/v1/orders` | List all orders |
| GET | `/api/v1/orders/:id` | Get one order |
| POST | `/api/v1/orders` | Create order. Body: `{ catalogId, quantity, customer }` |
| PATCH | `/api/v1/orders/:id/status` | Update status. Body: `{ status }` |
| DELETE | `/api/v1/orders/:id` | Delete order |

Statuses: `PLACED, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED`

## 2. WebSocket Events (Socket.io)
**Client -> Server**
| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ orderId, role }` | Join the chat room `order:<id>` (role: `customer` / `support`) |
| `room:leave` | `{ orderId }` | Leave the room |
| `chat:message` | `{ orderId, sender, text }` | Send a chat message |
| `chat:typing` | `{ orderId, sender }` | Typing indicator |

**Server -> Client**
| Event | Payload | Description |
|---|---|---|
| `order:created` | `order` | Broadcast when a new order is placed |
| `order:status` | `order` | Broadcast on any status change (REST or RPC cancel) |
| `chat:history` | `[message]` | Sent to the joiner with earlier messages |
| `chat:message` | `{ orderId, sender, text, time }` | New message in the room |
| `chat:typing` | `{ sender }` | Other party is typing |
| `room:joined` | `{ role, orderId }` | Other party joined the room |
| `room:notice` | `{ text }` | Order status notice inside the room |

## 3. JSON-RPC 2.0 (`POST /rpc`)
| Method | Params | Result |
|---|---|---|
| `cancelOrder` | `{ orderId }` | Updated order |
| `getOrderStatus` | `{ orderId }` | `{ orderId, status }` |
| `listOrders` | - | Array of orders |

```bash
curl -X POST $API/rpc -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"cancelOrder","params":{"orderId":1},"id":1}'
```
Error codes: `-32600` invalid request, `-32601` method not found, `-32001` order not found, `-32002` cannot cancel. Batch requests (array) are supported.

## 4. Server-Sent Events (`GET /events`)
Push-only stream of system alerts: `CONNECTED`, `NEW_ORDER`, `STATUS_CHANGED`, `ORDER_CANCELLED`.
```js
new EventSource(`${API}/events`).onmessage = (e) => console.log(JSON.parse(e.data));
```

## Deployment Guide
### 1. Backend on Render
Create a **Web Service** connected to this repository and set:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment variable | `CLIENT_URL=https://YOUR-APP.vercel.app` |

Use the exact Vercel site origin for `CLIENT_URL` (no trailing slash). Render supplies `PORT` automatically.

### 2. Frontend on Vercel
Import the repository and set:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment variable | `VITE_API_URL=https://YOUR-API.onrender.com` |

Use the Render service's public base URL for `VITE_API_URL` (no `/api/v1` suffix). Redeploy the Vercel app after changing this variable. If you use a custom Vercel domain, update Render's `CLIENT_URL` to that origin too.

> Note: Render free tier sleeps after inactivity; open the backend URL once before demo/submission.
> Data is stored in memory and resets on restart.
