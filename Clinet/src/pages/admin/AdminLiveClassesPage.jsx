import { useEffect, useState } from 'react';
import api from '../../api/client';
import './Admin.css';

const emptyForm = { subjectId: '', youtubeUrl: '', title: '' };

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function AdminLiveClassesPage() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [youtube, setYoutube] = useState(null);
  const [showKey, setShowKey] = useState(false);

  function loadClasses() {
    api.get('/admin/classes').then((res) => setClasses(res.data.classes));
  }

  function loadYoutube() {
    api.get('/admin/classes/youtube').then((res) => setYoutube(res.data));
  }

  useEffect(() => {
    api.get('/admin/subjects').then((res) => setSubjects(res.data.subjects));
    loadClasses();
    loadYoutube();
  }, []);

  const automatic = Boolean(youtube?.configured && !youtube.error);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleStart(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!form.subjectId) {
      setError('Choose a subject');
      return;
    }
    if (!automatic && !form.youtubeUrl.trim()) {
      setError('Paste the YouTube live link');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/admin/classes', { ...form, subjectId: Number(form.subjectId) });
      setForm(emptyForm);
      if (res.data.warning) setError(res.data.warning);
      setMessage(
        form.youtubeUrl.trim()
          ? 'Class is live — students who bought this subject can watch it now.'
          : 'Class created on YouTube. Start streaming in OBS — it goes live automatically and students who bought this subject can watch it here.'
      );
      loadClasses();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start class');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnd(c) {
    const stopHint = c.youtubeManaged ? 'Then stop streaming in OBS.' : 'Also stop the stream in YouTube Studio / OBS.';
    if (!confirm(`End "${c.title}"? ${stopHint}`)) return;
    try {
      const res = await api.post(`/admin/classes/${c.id}/end`);
      setMessage(res.data.message);
      loadClasses();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not end class');
    }
  }

  async function handleRename(c) {
    const title = prompt('Class title', c.title);
    if (!title || title.trim() === c.title) return;
    try {
      await api.put(`/admin/classes/${c.id}`, { title });
      loadClasses();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not rename class');
    }
  }

  async function handleRemove(c) {
    if (!confirm(`Remove "${c.title}" from the site? The video stays on YouTube.`)) return;
    try {
      await api.delete(`/admin/classes/${c.id}`);
      loadClasses();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not remove class');
    }
  }

  const liveClasses = classes.filter((c) => c.status === 'live');
  const recordedClasses = classes.filter((c) => c.status === 'completed');

  return (
    <div className="page">
      <div className="container">
        <h1>Admin · Live Classes</h1>
        {automatic ? (
          <p className="muted">
            Choose a subject and click <strong>Start class</strong> — an unlisted live stream is created
            on the YouTube channel and goes live as soon as OBS starts streaming. Only students who bought
            the subject can watch it here. When you end the class, YouTube keeps the recording and it
            appears under the subject's recorded classes.
          </p>
        ) : (
          <p className="muted">
            Go live on YouTube with visibility set to <strong>Unlisted</strong>, copy the stream's link,
            and paste it below. Only students who bought the subject can watch it here. When you end the
            class, YouTube keeps the recording and it appears under the subject's recorded classes.
          </p>
        )}

        {youtube?.configured && (
          <div className="card section-gap">
            <h2>OBS setup</h2>
            {youtube.error ? (
              <p role="alert">YouTube is not reachable: {youtube.error}</p>
            ) : (
              <>
                <p className="muted">
                  Set these once in OBS → Settings → Stream (Service: Custom). Every class uses the same key.
                  Never share the key — anyone with it can stream to your channel.
                </p>
                <div className="admin-form-grid">
                  <div>
                    <label htmlFor="obsServer">Server</label>
                    <input id="obsServer" value={youtube.serverUrl} readOnly onFocus={(e) => e.target.select()} />
                  </div>
                  <div>
                    <label htmlFor="obsKey">Stream key</label>
                    <input
                      id="obsKey"
                      type={showKey ? 'text' : 'password'}
                      value={youtube.streamKey}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="flex-row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? 'Hide key' : 'Show key'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={loadYoutube}>
                    Check OBS
                  </button>
                  <span className={`badge ${youtube.streamStatus === 'active' ? 'badge-success' : ''}`}>
                    OBS {youtube.streamStatus === 'active' ? 'is streaming' : 'not streaming'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="card section-gap">
          <h2>Start a class</h2>
          <form onSubmit={handleStart}>
            <div className="admin-form-grid">
              <div>
                <label htmlFor="subjectId">Subject</label>
                <select id="subjectId" name="subjectId" value={form.subjectId} onChange={handleChange} required>
                  <option value="">Choose a subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="youtubeUrl">YouTube live link{automatic ? ' (optional)' : ''}</label>
                <input
                  id="youtubeUrl"
                  name="youtubeUrl"
                  placeholder={automatic ? 'Leave empty to create it automatically' : 'https://youtube.com/live/...'}
                  value={form.youtubeUrl}
                  onChange={handleChange}
                  required={!automatic}
                />
              </div>
              <div>
                <label htmlFor="title">Title (optional)</label>
                <input
                  id="title"
                  name="title"
                  placeholder="e.g. Integration – part 2"
                  value={form.title}
                  onChange={handleChange}
                />
              </div>
            </div>

            {error && <p role="alert">{error}</p>}
            {message && <p className="alert-success">{message}</p>}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Starting...' : 'Start class'}
            </button>
          </form>
        </div>

        <h2 className="section-gap">Live now ({liveClasses.length})</h2>
        {liveClasses.length === 0 ? (
          <p className="muted">No class is live right now.</p>
        ) : (
          <div className="table-wrap section-gap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Title</th>
                  <th>Started</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {liveClasses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="badge badge-live">● LIVE</span> {c.subjectName}
                    </td>
                    <td>{c.title}</td>
                    <td>{formatDateTime(c.startedAt)}</td>
                    <td>
                      <div className="flex-row">
                        <a
                          href={`https://www.youtube.com/watch?v=${c.youtubeVideoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                        >
                          Open on YouTube
                        </a>
                        <button type="button" className="btn-danger" onClick={() => handleEnd(c)}>
                          End class
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="section-gap">Recorded classes ({recordedClasses.length})</h2>
        {recordedClasses.length === 0 ? (
          <p className="muted">Ended classes will show up here.</p>
        ) : (
          <div className="table-wrap section-gap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Title</th>
                  <th>Held on</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recordedClasses.map((c) => (
                  <tr key={c.id}>
                    <td>{c.subjectName}</td>
                    <td>{c.title}</td>
                    <td>{formatDateTime(c.startedAt)}</td>
                    <td>
                      <div className="flex-row">
                        <button type="button" className="btn-secondary" onClick={() => handleRename(c)}>
                          Rename
                        </button>
                        <button type="button" className="btn-danger" onClick={() => handleRemove(c)}>
                          Remove
                        </button>
                      </div>
                    </td>
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
