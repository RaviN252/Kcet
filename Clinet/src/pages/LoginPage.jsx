import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.token, res.data.user);
      navigate('/papers');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="container-narrow">
        <div className="card">
          <h1 className="center-text">Welcome back</h1>
          <p className="muted center-text">Log in to view your purchased papers.</p>

          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="Your password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="btn-block" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <p className="center-text muted" style={{ marginTop: 16 }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          <p className="center-text muted">
            No account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
