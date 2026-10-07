import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/client';
import { buildFolderTree, flattenFoldersForSelect } from '../../utils/folderTree';
import './Admin.css';

const emptyPaperForm = { title: '', folderId: '', status: 'published' };

function isPdfFile(file) {
  return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
}

function FolderNode({ node, depth, onRenameFolder, onDeleteFolder, onEditPaper, onDeletePaper }) {
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 20, marginTop: 12 }}>
      <div className="flex-between" style={{ alignItems: 'center' }}>
        <strong>📁 {node.name}</strong>
        <div className="flex-row">
          <button type="button" className="btn-secondary" onClick={() => onRenameFolder(node)}>
            Rename
          </button>
          <button type="button" className="btn-danger" onClick={() => onDeleteFolder(node)}>
            Delete
          </button>
        </div>
      </div>

      {node.papers.length > 0 && (
        <ul style={{ marginLeft: 20, marginTop: 8 }}>
          {node.papers.map((p) => (
            <li key={p.id} className="flex-between" style={{ padding: '4px 0' }}>
              <span>
                {p.title}{' '}
                <span className={`badge ${p.status === 'published' ? 'badge-success' : ''}`}>
                  {p.status}
                </span>
              </span>
              <div className="flex-row">
                <Link to={`/viewer/${p.id}`} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
                  View
                </Link>
                <button type="button" className="btn-secondary" onClick={() => onEditPaper(p)}>
                  Edit
                </button>
                <button type="button" className="btn-danger" onClick={() => onDeletePaper(p)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {node.children.map((child) => (
        <FolderNode
          key={child.id}
          node={child}
          depth={depth + 1}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onEditPaper={onEditPaper}
          onDeletePaper={onDeletePaper}
        />
      ))}
    </div>
  );
}

export default function AdminSubjectContentPage() {
  const { id: subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  const [folders, setFolders] = useState([]);
  const [papers, setPapers] = useState([]);

  const [folderName, setFolderName] = useState('');
  const [folderParentId, setFolderParentId] = useState('');
  const [folderError, setFolderError] = useState('');

  const [paperForm, setPaperForm] = useState(emptyPaperForm);
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [editingPaperId, setEditingPaperId] = useState(null);
  const [paperError, setPaperError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function loadSubject() {
    api.get('/admin/subjects').then((res) => {
      setSubject(res.data.subjects.find((s) => String(s.id) === subjectId) || null);
    });
  }

  function loadTree() {
    api.get(`/admin/folders/subject/${subjectId}`).then((res) => {
      setFolders(res.data.folders);
      setPapers(res.data.papers);
    });
  }

  useEffect(() => {
    loadSubject();
    loadTree();
  }, [subjectId]);

  const { rootFolders, rootPapers } = buildFolderTree(folders, papers);
  const folderOptions = flattenFoldersForSelect(folders);

  async function handleCreateFolder(e) {
    e.preventDefault();
    setFolderError('');
    if (!folderName.trim()) {
      setFolderError('Folder name is required');
      return;
    }
    try {
      await api.post('/admin/folders', {
        subjectId: Number(subjectId),
        parentFolderId: folderParentId ? Number(folderParentId) : undefined,
        name: folderName.trim(),
      });
      setFolderName('');
      setFolderParentId('');
      loadTree();
    } catch (err) {
      setFolderError(err.response?.data?.message || 'Could not create folder');
    }
  }

  async function handleRenameFolder(node) {
    const name = prompt('Rename folder to:', node.name);
    if (!name || !name.trim() || name.trim() === node.name) return;
    try {
      await api.put(`/admin/folders/${node.id}`, { name: name.trim() });
      loadTree();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not rename folder');
    }
  }

  async function handleDeleteFolder(node) {
    if (!confirm(`Delete folder "${node.name}"?`)) return;
    try {
      await api.delete(`/admin/folders/${node.id}`);
      loadTree();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete folder');
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected && !isPdfFile(selected)) {
      setPaperError('Only PDF files are allowed');
      e.target.value = '';
      setFile(null);
      return;
    }
    setPaperError('');
    setFile(selected || null);
  }

  function startEditPaper(p) {
    setEditingPaperId(p.id);
    setPaperForm({ title: p.title, folderId: p.folderId || '', status: p.status });
    setFile(null);
    setFileInputKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditPaper() {
    setEditingPaperId(null);
    setPaperForm(emptyPaperForm);
    setFile(null);
    setFileInputKey((k) => k + 1);
    setPaperError('');
  }

  async function handleSubmitPaper(e) {
    e.preventDefault();
    setPaperError('');

    if (file && !isPdfFile(file)) {
      setPaperError('Only PDF files are allowed');
      return;
    }

    setSubmitting(true);
    const data = new FormData();
    data.append('title', paperForm.title);
    data.append('subjectId', subjectId);
    data.append('folderId', paperForm.folderId || '');
    data.append('status', paperForm.status);
    if (file) data.append('pdf', file);

    try {
      if (editingPaperId) {
        await api.put(`/admin/papers/${editingPaperId}`, data);
      } else {
        if (!file) {
          setPaperError('A PDF file is required');
          setSubmitting(false);
          return;
        }
        await api.post('/admin/papers', data);
      }
      cancelEditPaper();
      loadTree();
    } catch (err) {
      setPaperError(err.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePaper(p) {
    if (!confirm(`Delete "${p.title}"? This also removes its purchase and payment history.`)) return;
    await api.delete(`/admin/papers/${p.id}`);
    loadTree();
  }

  if (!subject) {
    return (
      <div className="page">
        <div className="container center-text">
          <p className="muted">Loading subject...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <h1>Admin · {subject.name}</h1>
        <p className="muted">
          Add folders and papers to this subject. Buying <strong>{subject.name}</strong> unlocks
          everything here, in any folder. <Link to="/admin/subjects">Back to Manage Subjects</Link>
        </p>

        <div className="card section-gap">
          <h2>Create folder</h2>
          <form onSubmit={handleCreateFolder}>
            <div className="admin-form-grid">
              <div>
                <label htmlFor="folderName">Name</label>
                <input
                  id="folderName"
                  placeholder="e.g. Model Test Series"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="folderParentId">Inside folder (optional)</label>
                <select
                  id="folderParentId"
                  value={folderParentId}
                  onChange={(e) => setFolderParentId(e.target.value)}
                >
                  <option value="">Top level</option>
                  {folderOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {'— '.repeat(f.depth)}
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {folderError && <p role="alert">{folderError}</p>}
            <button type="submit">Create folder</button>
          </form>
        </div>

        <div className="card section-gap">
          <h2>{editingPaperId ? `Edit paper #${editingPaperId}` : 'Upload paper'}</h2>
          <form onSubmit={handleSubmitPaper}>
            <div className="admin-form-grid">
              <div>
                <label htmlFor="paperTitle">Title</label>
                <input
                  id="paperTitle"
                  placeholder="e.g. V1 Mathematics"
                  value={paperForm.title}
                  onChange={(e) => setPaperForm({ ...paperForm, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="paperFolderId">Folder (optional)</label>
                <select
                  id="paperFolderId"
                  value={paperForm.folderId}
                  onChange={(e) => setPaperForm({ ...paperForm, folderId: e.target.value })}
                >
                  <option value="">No folder (direct under subject)</option>
                  {folderOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {'— '.repeat(f.depth)}
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="paperStatus">Status</label>
                <select
                  id="paperStatus"
                  value={paperForm.status}
                  onChange={(e) => setPaperForm({ ...paperForm, status: e.target.value })}
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="pdf">{editingPaperId ? 'Replace PDF (optional)' : 'PDF file'}</label>
              <input key={fileInputKey} id="pdf" type="file" accept="application/pdf" onChange={handleFileChange} />
            </div>

            {paperError && <p role="alert">{paperError}</p>}

            <div className="flex-row">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingPaperId ? 'Save changes' : 'Upload paper'}
              </button>
              {editingPaperId && (
                <button type="button" className="btn-secondary" onClick={cancelEditPaper}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <h2 className="section-gap">Contents</h2>
        {rootFolders.length === 0 && rootPapers.length === 0 ? (
          <p className="muted">No folders or papers yet — add some above.</p>
        ) : (
          <div className="card">
            {rootPapers.length > 0 && (
              <ul>
                {rootPapers.map((p) => (
                  <li key={p.id} className="flex-between" style={{ padding: '4px 0' }}>
                    <span>
                      {p.title}{' '}
                      <span className={`badge ${p.status === 'published' ? 'badge-success' : ''}`}>
                        {p.status}
                      </span>
                    </span>
                    <div className="flex-row">
                      <Link to={`/viewer/${p.id}`} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
                        View
                      </Link>
                      <button type="button" className="btn-secondary" onClick={() => startEditPaper(p)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => handleDeletePaper(p)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {rootFolders.map((node) => (
              <FolderNode
                key={node.id}
                node={node}
                depth={0}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onEditPaper={startEditPaper}
                onDeletePaper={handleDeletePaper}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
