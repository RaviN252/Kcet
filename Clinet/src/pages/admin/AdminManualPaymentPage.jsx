import { useEffect, useState } from 'react';
import api from '../../api/client';
import './Admin.css';

export default function AdminManualPaymentPage() {
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [pending, setPending] = useState([]);
  const [pendingError, setPendingError] = useState('');
  const [userId, setUserId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function loadPending() {
    api.get('/admin/payments/pending').then((res) => setPending(res.data.pending));
  }

  useEffect(() => {
    api
      .get('/admin/users', { params: { limit: 2000 } })
      .then((res) => setUsers(res.data.users.filter((u) => u.role !== 'admin')));
    // Free subjects unlock automatically for everyone — nothing to mark as paid.
    api
      .get('/admin/subjects')
      .then((res) => setSubjects(res.data.subjects.filter((s) => Number(s.price) > 0)));
    loadPending();
  }, []);

  async function handleApprove(paymentId) {
    setPendingError('');
    try {
      await api.post(`/admin/payments/${paymentId}/approve`);
      loadPending();
    } catch (err) {
      setPendingError(err.response?.data?.message || 'Could not approve payment');
    }
  }

  async function handleReject(paymentId) {
    if (!confirm('Reject this payment claim?')) return;
    setPendingError('');
    try {
      await api.post(`/admin/payments/${paymentId}/reject`);
      loadPending();
    } catch (err) {
      setPendingError(err.response?.data?.message || 'Could not reject payment');
    }
  }

  const studentMatches =
    userId || !studentQuery.trim()
      ? []
      : users
          .filter((u) => {
            const q = studentQuery.trim().toLowerCase();
            return (
              u.name.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q) ||
              u.phone.includes(q)
            );
          })
          .slice(0, 8);

  function handleStudentQueryChange(e) {
    setStudentQuery(e.target.value);
    setUserId('');
  }

  function selectStudent(u) {
    setUserId(String(u.id));
    setStudentQuery(`${u.name} (${u.email})`);
  }

  function handleSubjectChange(e) {
    const selectedId = e.target.value;
    setSubjectId(selectedId);
    const selectedSubject = subjects.find((s) => String(s.id) === selectedId);
    setAmount(selectedSubject ? String(selectedSubject.price) : '');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!userId || !subjectId) {
      setError('Choose both a student and a subject');
      return;
    }
    if (amount === '' || Number(amount) < 0) {
      setError('Enter a valid amount collected');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/admin/payments/manual', {
        userId: Number(userId),
        subjectId: Number(subjectId),
        amount: Number(amount),
      });
      setMessage(res.data.message);
      setUserId('');
      setStudentQuery('');
      setSubjectId('');
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="container">
        <h1>Admin · Mark Payment</h1>
        <p className="muted">
          Record an offline payment (cash, bank transfer, UPI outside the app) and unlock the
          subject immediately for that student.
        </p>

        <h2 className="section-gap">Pending UPI payments ({pending.length})</h2>
        {pendingError && <p role="alert">{pendingError}</p>}
        {pending.length === 0 ? (
          <p className="muted">No pending claims right now.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Subject</th>
                  <th>Amount</th>
                  <th>UTR</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>
                      {p.studentName}
                      <div className="muted" style={{ fontSize: '0.85rem' }}>
                        {p.studentEmail} · {p.studentPhone}
                      </div>
                    </td>
                    <td>{p.subjectName}</td>
                    <td>₹{p.amount}</td>
                    <td>{p.utr}</td>
                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="flex-row">
                        <button type="button" onClick={() => handleApprove(p.id)}>
                          Approve
                        </button>
                        <button type="button" className="btn-danger" onClick={() => handleReject(p.id)}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="section-gap">Record a payment manually</h2>
        <div className="container-narrow" style={{ marginLeft: 0 }}>
        <div className="card section-gap">
          <form onSubmit={handleSubmit}>
            <div style={{ position: 'relative' }}>
              <label htmlFor="studentQuery">Student</label>
              <input
                id="studentQuery"
                type="text"
                autoComplete="off"
                placeholder="Search by name, email, or phone..."
                value={studentQuery}
                onChange={handleStudentQueryChange}
                required
              />
              {studentMatches.length > 0 && (
                <ul
                  style={{
                    position: 'absolute',
                    zIndex: 10,
                    left: 0,
                    right: 0,
                    margin: 0,
                    marginTop: 4,
                    padding: 0,
                    listStyle: 'none',
                    background: 'var(--card-bg, #fff)',
                    border: '1px solid var(--border, #e2e2e2)',
                    borderRadius: 'var(--radius-md, 8px)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {studentMatches.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => selectStudent(u)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          background: 'transparent',
                          color: 'inherit',
                          border: 'none',
                          borderRadius: 0,
                          boxShadow: 'none',
                          transform: 'none',
                        }}
                      >
                        <strong>{u.name}</strong>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>
                          {u.email} · {u.phone}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label htmlFor="subjectId">Subject</label>
              <select id="subjectId" value={subjectId} onChange={handleSubjectChange} required>
                <option value="">Select a subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ₹{s.price}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="amount">Amount collected (₹)</label>
              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 200"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="muted" style={{ marginTop: 4, fontSize: '0.85rem' }}>
                Defaults to the subject's price — lower this if you collected a discounted amount.
              </p>
            </div>

            {error && <p role="alert">{error}</p>}
            {message && <p className="alert-success">{message}</p>}

            <button type="submit" className="btn-block" disabled={submitting}>
              {submitting ? 'Recording...' : 'Mark as paid & unlock'}
            </button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
