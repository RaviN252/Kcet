import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import PasswordInput from '../components/PasswordInput';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setMessage('Password reset. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="page">
        <div className="container-narrow">
          <div className="card">
            <h1 className="center-text">Reset password</h1>
            <p className="muted center-text">
              This link is missing or invalid. Please request a new password reset email.
            </p>
            <p className="center-text" style={{ marginTop: 16 }}>
              <Link to="/forgot-password">Request a new reset link</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container-narrow">
        <div className="card">
          <h1 className="center-text">Reset password</h1>
          <p className="muted center-text">Choose a new password for your account.</p>

          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password">New password</label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-block" disabled={submitting}>
              {submitting ? 'Resetting...' : 'Reset password'}
            </button>
          </form>

          {message && <p className="alert-success" style={{ marginTop: 16 }}>{message}</p>}
        </div>
      </div>
    </div>
  );
}
