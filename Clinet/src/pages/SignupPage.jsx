import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
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

    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setError('Phone number must be exactly 10 digits');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Enter a valid email address');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/auth/signup', form);
      login(res.data.token, res.data.user);
      navigate('/papers');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="container-narrow">
        <div className="card">
          <h1 className="center-text">Create your account</h1>
          <p className="muted center-text">Sign up to unlock and read purchased papers.</p>

          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name">Name</label>
              <input id="name" name="name" placeholder="Your full name" value={form.name} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit phone number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                required
              />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="btn-block" disabled={submitting}>
              {submitting ? 'Signing up...' : 'Sign up'}
            </button>
          </form>

          <p className="center-text muted" style={{ marginTop: 16 }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
