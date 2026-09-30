import { useState } from 'react';
import { rest, STATUSES } from '../api.js';
import Chat from './Chat.jsx';

export default function Support({ orders }) {
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  const setStatus = async (id, status) => {
    setError('');
    try { await rest(`/orders/${id}/status`, { method: 'PATCH', body: { status } }); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="grid support-grid">
      <section className="card support-orders">
        <div className="section-heading"><div><span className="section-icon support-icon">◈</span><div><h3>All customer orders</h3><p>Update a shipment or jump into a conversation.</p></div></div><span className="count-pill">{orders.length} total</span></div>
        {error && <p className="error" role="alert">{error}</p>}
        {orders.length === 0 && <div className="empty-state"><span className="empty-icon">▱</span><strong>No orders to work on</strong><p>New customer orders will appear here.</p></div>}
        {[...orders].reverse().map((o) => (
          <div key={o.id} className={`order ${selected === o.id ? 'sel' : ''}`}>
            <div className="order-topline"><span className="order-ref">Order #{o.id}</span><span className={`badge ${o.status}`}>{o.status}</span></div>
            <div className="order-product"><strong>{o.item} <span className="quantity-mark">×{o.quantity}</span></strong><span>Customer: {o.customer}</span></div>
            <div className="row order-actions">
              <select aria-label={`Update order ${o.id} status`} value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="secondary-action" onClick={() => setSelected(o.id)}>Open chat <span>↗</span></button>
            </div>
          </div>
        ))}
      </section>
      <section className="card">
        {selected ? <Chat orderId={selected} role="support" /> : <div className="empty-state chat-empty"><span className="empty-icon">✉</span><strong>Customer conversations</strong><p>Choose an order to open its live chat.</p></div>}
      </section>
    </div>
  );
}
