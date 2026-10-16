import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import './PapersPage.css';

export default function MyPurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/purchases')
      .then((res) => setPurchases(res.data.purchases))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="container">
        <h1>My Purchases</h1>
        <p className="muted">Subjects you've unlocked — papers, live classes and recorded classes.</p>

        {loading ? (
          <p className="muted section-gap">Loading...</p>
        ) : purchases.length === 0 ? (
          <div className="card center-text section-gap">
            <p className="muted">You haven't purchased any subjects yet.</p>
            <Link to="/papers" className="btn">
              Browse subjects
            </Link>
          </div>
        ) : (
          <div className="card-grid section-gap">
            {purchases.map((s) => (
              <Link to={`/papers/${s.id}`} className="paper-card" key={s.id}>
                <div className="tags">
                  {Boolean(s.liveNow) && <span className="badge badge-live">● Live now</span>}
                  <span className="badge">
                    {s.papers.length} paper{s.papers.length === 1 ? '' : 's'}
                  </span>
                  {s.recordingCount > 0 && (
                    <span className="badge">
                      {s.recordingCount} recorded class{s.recordingCount === 1 ? '' : 'es'}
                    </span>
                  )}
                </div>
                <h3>{s.name}</h3>
                <div className="flex-between" style={{ marginTop: 8 }}>
                  <span className="badge badge-success">Purchased</span>
                  <span className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    {s.liveNow ? 'Join live class' : 'Open'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
