import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import ProtectedView from '../components/ProtectedView';
import './ViewerPage.css';

export default function ViewerPage() {
  const { id } = useParams();
  const [meta, setMeta] = useState(null);
  const [pageUrls, setPageUrls] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrls = [];

    async function load() {
      try {
        const { data } = await api.get(`/viewer/${id}`);
        setMeta(data);

        const urls = [];
        for (let page = 1; page <= data.pageCount; page++) {
          const res = await api.get(`/viewer/${id}/pages/${page}`, { responseType: 'blob' });
          const url = URL.createObjectURL(res.data);
          urls.push(url);
        }
        objectUrls = urls;
        setPageUrls(urls);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load this paper');
      }
    }

    load();

    return () => {
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [id]);

  useEffect(() => {
    function blockContextMenu(e) {
      e.preventDefault();
    }
    document.addEventListener('contextmenu', blockContextMenu);
    return () => document.removeEventListener('contextmenu', blockContextMenu);
  }, []);

  if (error) {
    return (
      <div className="page">
        <div className="container-narrow center-text">
          <p role="alert">{error}</p>
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="page">
        <div className="container-narrow center-text">
          <p className="muted">Loading paper...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedView>
      <div className="page viewer">
        <div className="container-narrow">
          <div className="viewer-header">
            <h1>{meta.paper.title}</h1>
            <p className="muted">
              {meta.paper.subject} · {meta.pageCount} page
              {meta.pageCount === 1 ? '' : 's'}
            </p>
            <p className="muted viewer-note">
              🔒 View-only — right-click, printing, and downloading are disabled. Pages carry your
              name, phone, and email for traceability.
            </p>
          </div>

          <div className="viewer-pages">
            {pageUrls.map((url, i) => (
              <img key={url} src={url} alt={`Page ${i + 1}`} draggable={false} />
            ))}
          </div>
        </div>
      </div>
    </ProtectedView>
  );
}
