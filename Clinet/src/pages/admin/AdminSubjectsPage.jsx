import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import './Admin.css';

const emptyForm = { name: '', price: '' };

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function loadSubjects() {
    api.get('/admin/subjects').then((res) => setSubjects(res.data.subjects));
  }

  useEffect(loadSubjects, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function startEdit(s) {
    setEditingId(s.id);
    setForm({ name: s.name, price: s.price });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Subject name is required');
      return;
    }
    if (form.price === '' || Number(form.price) < 0) {
      setError('Price must be a non-negative number');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/admin/subjects/${editingId}`, form);
      } else {
        await api.post('/admin/subjects', form);
      }
      cancelEdit();
      loadSubjects();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(s) {
    if (!confirm(`Delete subject "${s.name}"?`)) return;
    try {
      await api.delete(`/admin/subjects/${s.id}`);
      loadSubjects();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete subject');
    }
  }

  return (
    <div className="page">
      <div className="container">
        <h1>Admin · Subjects</h1>
        <p className="muted">
          A subject is what students buy. Set its price here, then click "Add" on a subject below
          to add folders and papers to it — buying the subject unlocks everything in it, including
          folders/papers added later.
        </p>

        <div className="card section-gap">
          <h2>{editingId ? `Edit subject #${editingId}` : 'Create subject'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <div>
                <label htmlFor="name">Name</label>
                <input id="name" name="name" placeholder="e.g. Maths" value={form.name} onChange={handleChange} required />
              </div>
              <div>
                <label htmlFor="price">Price (₹)</label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 300 (0 = free)"
                  value={form.price}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {error && <p role="alert">{error}</p>}

            <div className="flex-row">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Create subject'}
              </button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <h2 className="section-gap">All subjects ({subjects.length})</h2>
        <div className="table-wrap section-gap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Papers</th>
                <th>Purchases</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{Number(s.price) === 0 ? 'Free' : `₹${s.price}`}</td>
                  <td>{s.paperCount}</td>
                  <td>{s.purchaseCount}</td>
                  <td>
                    <div className="flex-row">
                      <Link to={`/admin/subjects/${s.id}/content`} className="btn">
                        Add
                      </Link>
                      <button type="button" className="btn-secondary" onClick={() => startEdit(s)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => handleDelete(s)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
