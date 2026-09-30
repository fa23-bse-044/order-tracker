import { useEffect, useState } from 'react';
import { API } from '../api.js';

// Server-Sent Events: live system alerts
export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    const es = new EventSource(`${API}/events`);
    es.onmessage = (e) => setAlerts((prev) => [JSON.parse(e.data), ...prev].slice(0, 30));
    return () => es.close();
  }, []);
  return (
    <aside className="card alerts">
      <div className="alerts-heading"><div><span className="alerts-icon">⌁</span><div><h3>Live activity</h3><p>Updates as they happen</p></div></div><span className="activity-pulse" aria-label="Live" /></div>
      <div className="alerts-feed">
      {alerts.length === 0 && <div className="empty-state alert-empty"><span className="empty-icon">⌁</span><strong>All caught up</strong><p>New order activity will appear here.</p></div>}
      {alerts.map((a, i) => (
        <div key={i} className={`alert ${a.type}`}>
          <span className="alert-marker" />
          <div className="alert-content"><b>{a.type.replace('_', ' ')}</b><div>{a.message}</div>{a.time && <small>{new Date(a.time).toLocaleTimeString()}</small>}</div>
        </div>
      ))}
      </div>
    </aside>
  );
}
