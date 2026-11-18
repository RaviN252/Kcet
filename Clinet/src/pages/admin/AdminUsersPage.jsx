import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { downloadCsv } from '../../utils/downloadCsv';
import SubjectFilter from './SubjectFilter';
import './Admin.css';

const emptyForm = { name: '', phone: '', email: '', password: '' };
const PAGE_SIZE = 50;
const VISIBLE_SUBJECTS = 2;

// Purchased subjects as compact chips — long lists collapse behind a "+N more" toggle
// so one heavy buyer doesn't stretch their row to the height of the screen.
function SubjectChips({ names }) {
  const [expanded, setExpanded] = useState(false);
  const subjects = names ? names.split(', ') : [];
  if (subjects.length === 0) return <span className="muted">None</span>;

  const shown = expanded ? subjects : subjects.slice(0, VISIBLE_SUBJECTS);
  const hiddenCount = subjects.length - shown.length;

  return (
    <div className="subject-chips">
      {shown.map((name) => (
        <span key={name} className="subject-chip" title={name}>
          {name}
        </span>
      ))}
      {subjects.length > VISIBLE_SUBJECTS && (
        <button type="button" className="subject-chip-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

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
  const [subjects, setSubjects] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/admin/subjects').then((res) => setSubjects(res.data.subjects));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const filterParams = useMemo(
    () => ({ q: debouncedSearch || undefined, subjectId: subjectFilter.join(',') || undefined }),
    [debouncedSearch, subjectFilter]
  );

  // Exports every user matching the current search + subject filter — all pages, not just this one.
  async function handleExport() {
    setExporting(true);
    try {
      await downloadCsv('/admin/users/export', filterParams, 'users.csv');
    } catch {
      window.alert('Could not export users');
    } finally {
      setExporting(false);
    }
  }

  function loadUsers() {
    api
      .get('/admin/users', { params: { page, limit: PAGE_SIZE, ...filterParams } })
      .then((res) => {
        setUsers(res.data.users);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      });
  }

  useEffect(loadUsers, [page, filterParams]);

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
        <div className="users-filters">
          <input
            type="search"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
          <SubjectFilter
            subjects={subjects}
            value={subjectFilter}
            onChange={(next) => {
              setSubjectFilter(next);
              setPage(1);
            }}
          />
          <button
            type="button"
            className="btn-export users-export"
            onClick={handleExport}
            disabled={exporting || total === 0}
            title={`Download these ${total} user(s) as CSV`}
          >
            {exporting ? 'Exporting...' : `Export CSV (${total})`}
          </button>
        </div>

        {users.length === 0 ? (
          <div className="card center-text section-gap">
            <p className="muted" style={{ marginBottom: 0 }}>No users match these filters.</p>
          </div>
        ) : (
        <>
        <div className="table-wrap section-gap">
          <table className="users-table">
            <thead>
              <tr>
                <th className="col-index">#</th>
                <th>Student</th>
                <th>Subjects purchased</th>
                <th className="col-paid">Total paid</th>
                <th className="col-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id}>
                  <td className="col-index muted">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td>
                    <div className="user-cell-name">
                      {u.name}
                      {u.role === 'admin' && <span className="badge badge-accent">admin</span>}
                    </div>
                    <div className="user-cell-meta">{u.email}</div>
                    <div className="user-cell-meta">{u.phone}</div>
                  </td>
                  <td data-label="Subjects">
                    <SubjectChips names={u.subjectNames} />
                  </td>
                  <td className="col-paid" data-label="Total paid">
                    {Number(u.totalPaid) > 0 ? (
                      <span className="badge badge-success">₹{u.totalPaid}</span>
                    ) : (
                      <span className="muted">₹0.00</span>
                    )}
                  </td>
                  <td className="col-actions">
                    <div className="user-actions">
                      <button type="button" className="btn-sm" onClick={() => handleEdit(u)}>
                        Edit
                      </button>
                      {u.id !== currentUser?.id && (
                        <button type="button" className="btn-sm btn-danger" onClick={() => handleDelete(u)}>
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
