import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './Admin.css';

const emptyForm = { name: '', phone: '', email: '', password: '' };
const PAGE_SIZE = 50;

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function loadUsers() {
    api
      .get('/admin/users', { params: { page, limit: PAGE_SIZE, q: debouncedSearch } })
      .then((res) => {
        setUsers(res.data.users);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      });
  }

  useEffect(loadUsers, [page, debouncedSearch]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handlePhoneChange(e) {
    setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setError('Phone number must be exactly 10 digits');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Enter a valid email address');
      return;
    }
    if (!editingId && form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (editingId && form.password && form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/admin/users/${editingId}`, form);
        setMessage(`Updated ${form.name}`);
      } else {
        const res = await api.post('/admin/users', form);
        setMessage(`Created account for ${res.data.user.name}`);
      }
      setForm(emptyForm);
      setEditingId(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || (editingId ? 'Could not update user' : 'Could not create user'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(u) {
    setEditingId(u.id);
    setForm({ name: u.name, phone: u.phone, email: u.email, password: '' });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setMessage('');
  }

  async function handleDelete(u) {
    if (!confirm(`Delete ${u.name}? This also removes their purchase and payment history.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      if (editingId === u.id) handleCancelEdit();
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete user');
    }
  }

  return (
    <div className="page">
      <div className="container">
        <h1>Admin · Users &amp; Payments</h1>
        <p className="muted">{total} registered users.</p>

        <div className="card section-gap">
          <h2>{editingId ? `Edit user #${editingId}` : 'Create user'}</h2>
          <p className="muted">
            {editingId
              ? 'Leave the password blank to keep their current password.'
              : 'For students who paid offline — create their account here, then mark their payment as paid on the Manual Payment page.'}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <div>
                <label htmlFor="name">Name</label>
                <input id="name" name="name" placeholder="Full name" value={form.name} onChange={handleChange} required />
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
                  onChange={handlePhoneChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
              </div>
              <div>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={editingId ? 'Leave blank to keep current password' : 'At least 6 characters'}
                  value={form.password}
                  onChange={handleChange}
                  required={!editingId}
                />
              </div>
            </div>

            {error && <p role="alert">{error}</p>}
            {message && <p className="alert-success">{message}</p>}

            <div className="flex-row">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Create user'}
              </button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <h2 className="section-gap">All users ({total})</h2>
        <input
          type="search"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />

        {users.length === 0 ? (
          <div className="card center-text section-gap">
            <p className="muted" style={{ marginBottom: 0 }}>No users match that search.</p>
          </div>
        ) : (
        <>
        <div className="table-wrap section-gap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Subjects purchased</th>
                <th>Total paid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id}>
                  <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.phone}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-accent' : ''}`}>{u.role}</span>
                  </td>
                  <td>{u.subjectNames || '0'}</td>
                  <td>
                    {Number(u.totalPaid) > 0 ? (
                      <span className="badge badge-success">₹{u.totalPaid}</span>
                    ) : (
                      <span className="muted">₹0.00</span>
                    )}
                  </td>
                  <td>
                    <div className="flex-row" style={{ flexWrap: 'nowrap' }}>
                      <button type="button" onClick={() => handleEdit(u)}>
                        Edit
                      </button>
                      {u.id !== currentUser?.id && (
                        <button type="button" className="btn-danger" onClick={() => handleDelete(u)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex-row section-gap" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="muted">
              Page {page} of {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
