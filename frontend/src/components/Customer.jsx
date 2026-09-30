import { useEffect, useState } from 'react';
import { rest, rpc } from '../api.js';
import Chat from './Chat.jsx';

export default function Customer({ orders }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogId, setCatalogId] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('Customer');
  const [mine, setMine] = useState(() => JSON.parse(localStorage.getItem('myOrders') || '[]'));
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { rest('/catalog').then(setCatalog).catch((e) => setError(e.message)); }, []);
  useEffect(() => localStorage.setItem('myOrders', JSON.stringify(mine)), [mine]);

  const place = async (e) => {
    e.preventDefault(); setError('');
    try {
      const o = await rest('/orders', { method: 'POST', body: { catalogId, quantity, customer: name } });
      setMine((p) => [...p, o.id]); setSelected(o.id);
    } catch (err) { setError(err.message); }
  };
  const cancel = async (id) => {
    setError('');
    try { await rpc('cancelOrder', { orderId: id }); } catch (err) { setError(err.message); }
  };

  const myOrders = orders.filter((o) => mine.includes(o.id));
  const selectedProduct = catalog.find((item) => String(item.id) === String(catalogId));
  const orderTotal = Number(selectedProduct?.price || 0) * Number(quantity || 0);

  return (
    <div className="grid customer-grid">
      <div className="customer-column">
      <section className="card order-create">
        <div className="section-heading"><div><span className="section-icon">＋</span><div><h3>Start a new order</h3><p>Choose an item and we’ll take it from here.</p></div></div><span className="api-tag">REST API</span></div>
        <form onSubmit={place} className="stack">
          <label htmlFor="customer-name">Your name</label>
          <input id="customer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Morgan" />
          <label htmlFor="catalog-item">What are you ordering?</label>
          <select id="catalog-item" value={catalogId} onChange={(e) => setCatalogId(e.target.value)}>
            {catalog.map((c) => <option key={c.id} value={c.id}>{c.name} - ${c.price}</option>)}
          </select>
          <label htmlFor="quantity">Quantity</label>
          <input id="quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <div className="order-total"><span>Estimated total</span><strong>${orderTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
          <button className="primary-action">Place order <span>→</span></button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <section className="card orders-card">
        <div className="section-heading"><div><span className="section-icon orders-icon">▤</span><div><h3>Your order history</h3><p>{myOrders.length} {myOrders.length === 1 ? 'order' : 'orders'} placed</p></div></div></div>
        {myOrders.length === 0 && <div className="empty-state"><span className="empty-icon">▱</span><strong>No orders just yet</strong><p>Your placed orders will show up here.</p></div>}
        {myOrders.map((o) => (
          <div key={o.id} className={`order ${selected === o.id ? 'sel' : ''}`}>
            <div className="order-topline"><span className="order-ref">Order #{o.id}</span><span className={`badge ${o.status}`}>{o.status}</span></div>
            <div className="order-product"><strong>{o.item}</strong><span>Qty {o.quantity} <i>·</i> ${o.total}</span></div>
            <div className="row order-actions">
              <button className="secondary-action" onClick={() => setSelected(o.id)}>Open chat <span>↗</span></button>
              <button className="text-action" onClick={() => cancel(o.id)} disabled={['CANCELLED', 'DELIVERED'].includes(o.status)} title="Cancel order via JSON-RPC">Cancel order</button>
            </div>
          </div>
        ))}
      </section>
      </div>
      <section className="card">
        {selected ? <Chat orderId={selected} role="customer" /> : <div className="empty-state chat-empty"><span className="empty-icon">✉</span><strong>Your support chat</strong><p>Select an order to message our support team.</p></div>}
      </section>
    </div>
  );
}
