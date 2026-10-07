import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="container-narrow">
        <div className="card">
          <h1 className="center-text">Forgot password</h1>
          <p className="muted center-text">We'll email you a link to reset it.</p>

          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="Your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-block" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          {message && <p className="alert-success" style={{ marginTop: 16 }}>{message}</p>}

          <p className="center-text muted" style={{ marginTop: 16 }}>
            <Link to="/reset-password">Already have a reset token?</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
