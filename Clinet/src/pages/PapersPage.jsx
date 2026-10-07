import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import './PapersPage.css';

export default function PapersPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/subjects')
      .then((res) => setSubjects(res.data.subjects))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="container">
        <div className="flex-between">
          <div>
            <h1>Subjects</h1>
            <p className="muted">
              Buy a subject once to unlock every paper in it — free to browse, pay only to unlock.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="muted section-gap">Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <div className="card center-text section-gap">
            <p className="muted" style={{ marginBottom: 0 }}>No subjects available yet.</p>
          </div>
        ) : (
          <div className="card-grid section-gap">
            {subjects.map((s) => (
              <Link to={`/papers/${s.id}`} className="paper-card" key={s.id}>
                <div className="tags">
                  <span className="badge">
                    {s.paperCount} paper{s.paperCount === 1 ? '' : 's'}
                  </span>
                </div>
                <h3>{s.name}</h3>
                <div className="flex-between" style={{ marginTop: 8 }}>
                  <span className="price-tag">{Number(s.price) === 0 ? 'Free' : `₹${s.price}`}</span>
                  <span className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    View details
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
