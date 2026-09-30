import { useEffect, useState } from 'react';
import { rest, socket } from './api.js';
import Customer from './components/Customer.jsx';
import Support from './components/Support.jsx';
import Alerts from './components/Alerts.jsx';

export default function App() {
  const [tab, setTab] = useState('customer');
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const activeOrders = orders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)).length;
  const deliveredOrders = orders.filter((order) => order.status === 'DELIVERED').length;
  const inTransit = orders.filter((order) => ['PACKED', 'SHIPPED'].includes(order.status)).length;

  useEffect(() => {
    rest('/orders').then(setOrders).catch(() => {});
    setConnected(socket.connected);
    const upsert = (o) =>
      setOrders((prev) => (prev.some((x) => x.id === o.id) ? prev.map((x) => (x.id === o.id ? o : x)) : [...prev, o]));
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('order:created', upsert);
    socket.on('order:status', upsert);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('order:created', upsert);
      socket.off('order:status', upsert);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Parcel home">
          <span className="brand-mark">p</span>
          <span>parcel<span className="brand-period">.</span><small>ORDER WORKSPACE</small></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace navigation">
          <button className={tab === 'customer' ? 'active' : ''} onClick={() => setTab('customer')}>
            <span className="nav-icon">▦</span>Customer portal<span className="nav-arrow">›</span>
          </button>
          <button className={tab === 'support' ? 'active' : ''} onClick={() => setTab('support')}>
            <span className="nav-icon">◉</span>Support desk<span className="nav-arrow">›</span>
          </button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <span className={`status-orb ${connected ? 'on' : 'off'}`} />
          <div><strong>{connected ? 'All systems live' : 'Reconnecting'}</strong><small>Real-time connection</small></div>
          <span className="status-pulse" />
        </div>
        <div className="sidebar-profile"><span className="profile-avatar">{tab === 'customer' ? 'C' : 'S'}</span><span><strong>{tab === 'customer' ? 'Customer' : 'Support team'}</strong><small>{tab === 'customer' ? 'Personal workspace' : 'Agent workspace'}</small></span><span className="profile-menu">···</span></div>
      </aside>

      <main className="workspace" id="top">
        <div className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{tab === 'customer' ? 'Customer portal' : 'Support desk'}</strong></div>
          <div className="topbar-right"><span className="today-label">Live order operations</span><span className="topbar-avatar">{tab === 'customer' ? 'C' : 'S'}</span></div>
        </div>
        <section className="welcome-row">
          <div><div className="eyebrow"><span className="eyebrow-line" />ORDER MANAGEMENT</div><h1>{tab === 'customer' ? 'Your orders, all in one place.' : 'Support, in sync.'}</h1><p>{tab === 'customer' ? 'Place an order, follow every update, and reach our team whenever you need.' : 'Keep every order moving and every customer in the loop.'}</p></div>
          <div className="live-badge"><span /> LIVE UPDATES</div>
        </section>

        <section className="metrics" aria-label="Order overview">
          <article className="metric-card"><div className="metric-icon violet">↗</div><div className="metric-copy"><span>ACTIVE ORDERS</span><strong>{activeOrders}</strong><small>Currently being processed</small></div><div className="metric-decoration">01</div></article>
          <article className="metric-card"><div className="metric-icon amber">⌁</div><div className="metric-copy"><span>IN TRANSIT</span><strong>{inTransit}</strong><small>Packed or on the way</small></div><div className="metric-decoration">02</div></article>
          <article className="metric-card"><div className="metric-icon green">✓</div><div className="metric-copy"><span>DELIVERED</span><strong>{deliveredOrders}</strong><small>Successfully completed</small></div><div className="metric-decoration">03</div></article>
          <article className="metric-card metric-total"><div className="metric-icon blue">▤</div><div className="metric-copy"><span>ALL ORDERS</span><strong>{orders.length}</strong><small>Across this workspace</small></div><div className="metric-decoration">04</div></article>
        </section>

        <div className="section-heading"><div><span className="section-kicker">YOUR WORKSPACE</span><h2>{tab === 'customer' ? 'Order center' : 'Operations center'}</h2></div><span className="connection-label"><span className={`status-orb ${connected ? 'on' : 'off'}`} />{connected ? 'Synced just now' : 'Connection interrupted'}</span></div>
        <div className="layout">
          <div className="primary-content">{tab === 'customer' ? <Customer orders={orders} /> : <Support orders={orders} />}</div>
          <Alerts />
        </div>
        <footer className="footer"><span>© 2025 Parcel workspace</span><span>Order updates are delivered in real time <b>•</b></span></footer>
      </main>
    </div>
  );
}
