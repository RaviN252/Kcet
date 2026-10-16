import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import './Admin.css';

const adminLinks = [
  { to: '/admin/subjects', label: 'Manage Subjects' },
  { to: '/admin/live-classes', label: 'Live Classes' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/manual-payment', label: 'Mark Payment' },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setStats(res.data));
  }, []);

  return (
    <div className="page">
      <div className="container">
        <h1>Admin · Dashboard</h1>
        <p className="muted">A snapshot of revenue and top-performing content.</p>

        <div className="flex-row section-gap" style={{ flexWrap: 'wrap' }}>
          {adminLinks.map((link) => (
            <Link key={link.to} to={link.to} className="btn btn-secondary">
              {link.label}
            </Link>
          ))}
        </div>

        {!stats ? (
          <p className="muted section-gap">Loading stats...</p>
        ) : (
          <>
            <div className="stat-grid section-gap">
              <div className="stat-tile">
                <div className="stat-label">Total revenue</div>
                <div className="stat-value">₹{stats.totalRevenue}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Paid users</div>
                <div className="stat-value">{stats.paidUsers}</div>
              </div>
            </div>

            <div className="section-gap">
              <h2>Top subjects</h2>
              {stats.topSubjects.length === 0 ? (
                <p className="muted">No sales yet.</p>
              ) : (
                <ul className="insight-list">
                  {stats.topSubjects.map((s) => (
                    <li key={s.id ?? s.subject}>
                      <span>{s.subject}</span>
                      <span className="muted">{s.salesCount} sales · ₹{s.revenue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
