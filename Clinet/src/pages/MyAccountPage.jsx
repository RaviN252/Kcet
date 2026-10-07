import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function MyAccountPage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
    }
    // The cached user from login/signup doesn't carry dateOfBirth — fetch the full
    // profile fresh so it shows up even right after logging in.
    api.get('/auth/me').then((res) => {
      setName(res.data.user.name);
      setPhone(res.data.user.phone);
      setDateOfBirth(res.data.user.dateOfBirth || '');
    });
  }, [user]);

  useEffect(() => {
    api
      .get('/payments/mine')
      .then((res) => setPayments(res.data.payments))
      .finally(() => setLoadingPayments(false));
  }, []);

  function handlePhoneChange(e) {
    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Phone number must be exactly 10 digits');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.put('/auth/me', { name: name.trim(), phone, dateOfBirth });
      updateUser(res.data.user);
      setMessage('Profile updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update profile');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="page">
      <div className="container">
        <h1>My Account</h1>
        <p className="muted">Update your details and see your payment history.</p>

        <div className="container-narrow" style={{ marginLeft: 0 }}>
        <div className="card section-gap">
          <h2>Profile</h2>
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={handlePhoneChange}
                required
              />
            </div>
            <div>
              <label htmlFor="dob">Date of birth</label>
              <input
                id="dob"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" value={user.email} disabled />
              <p className="muted" style={{ marginTop: 4, fontSize: '0.85rem' }}>
                Email is your login ID and can't be changed here.
              </p>
            </div>

            {error && <p role="alert">{error}</p>}
            {message && <p className="alert-success">{message}</p>}

            <button type="submit" className="btn-block" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>
        </div>

        <h2 className="section-gap">Payment history</h2>
        {loadingPayments ? (
          <p className="muted">Loading...</p>
        ) : payments.length === 0 ? (
          <div className="card center-text">
            <p className="muted" style={{ marginBottom: 0 }}>No payments yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.subjectName}</td>
                    <td>₹{p.amount}</td>
                    <td>{p.paymentMethod}</td>
                    <td>
                      <span className={`badge ${p.status === 'success' ? 'badge-success' : ''}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
