import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { buildFolderTree, findNodeById, getFolderPath } from '../utils/folderTree';
import SubjectClasses from '../components/SubjectClasses';

function FolderRow({ subjectId, node }) {
  return (
    <Link to={`/papers/${subjectId}/folders/${node.id}`} className="folder-row">
      📁 {node.name}
    </Link>
  );
}

function PaperRow({ paper }) {
  return (
    <Link to={`/viewer/${paper.id}`} className="folder-row">
      📄 {paper.title}
    </Link>
  );
}

export default function PaperDetailPage() {
  const { id, folderId } = useParams();
  const { user } = useAuth();
  const [subject, setSubject] = useState(null);
  const [folders, setFolders] = useState([]);
  const [papers, setPapers] = useState([]);
  const [owned, setOwned] = useState(false);
  const [pendingClaim, setPendingClaim] = useState(null);
  const [pendingIntent, setPendingIntent] = useState(null);
  const [upiInfo, setUpiInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showUpiPanel, setShowUpiPanel] = useState(false);
  const [utr, setUtr] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.get(`/subjects/${id}`).then((res) => {
      setSubject(res.data.subject);
      setFolders(res.data.folders);
      setPapers(res.data.papers);
    });
    if (user) {
      api.get('/purchases').then((res) => {
        setOwned(res.data.purchases.some((p) => String(p.id) === id));
      });
      api.get('/payments/mine').then((res) => {
        const mine = res.data.payments.filter(
          (p) => String(p.subjectId) === id && p.paymentMethod === 'upi' && p.status === 'created'
        );
        const claim = mine.find((p) => p.utr);
        const intent = mine.find((p) => !p.utr);
        setPendingClaim(claim || null);
        setPendingIntent(intent || null);
        if (intent && !claim) setShowUpiPanel(true);
      });
    }
  }, [id, user]);

  useEffect(() => {
    api.get('/payments/upi-info').then((res) => setUpiInfo(res.data));
  }, []);

  const isAdmin = user?.role === 'admin';
  const isFree = Number(subject?.price) === 0;
  const canViewDirectly = owned || isAdmin;
  const { rootFolders, rootPapers } = buildFolderTree(folders, papers);
  const currentFolderNode = folderId ? findNodeById(rootFolders, folderId) : null;
  const folderPath = folderId ? getFolderPath(folders, folderId) : [];

  const upiUrl =
    upiInfo?.upiId && subject
      ? `upi://pay?pa=${encodeURIComponent(upiInfo.upiId)}&pn=${encodeURIComponent(
          upiInfo.payeeName
        )}&am=${Number(subject.price)}&cu=INR&tn=${encodeURIComponent(subject.name)}`
      : '';

  useEffect(() => {
    if (!showUpiPanel || !upiUrl) return;
    QRCode.toDataURL(upiUrl, { width: 220 }).then(setQrDataUrl);
  }, [showUpiPanel, upiUrl]);

  async function handleBuyClick() {
    setError('');
    try {
      await api.post('/payments/upi-intent', { subjectId: Number(id) });
    } catch (err) {
      // Not fatal — still let them see the payment screen even if this logging call fails.
    }
    setShowUpiPanel(true);
  }

  async function handleGetFree() {
    setError('');
    setPaying(true);
    try {
      await api.post('/payments/create-order', { subjectId: Number(id) });
      setOwned(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not unlock this subject');
    } finally {
      setPaying(false);
    }
  }

  async function handleSubmitClaim(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!utr.trim()) {
      setError('Enter the UPI transaction reference (UTR) number from your payment');
      return;
    }
    setPaying(true);
    try {
      const res = await api.post('/payments/upi-claim', { subjectId: Number(id), utr: utr.trim() });
      setMessage(res.data.message);
      setPendingClaim({ utr: utr.trim(), amount: subject.price });
      setPendingIntent(null);
      setShowUpiPanel(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit payment claim');
    } finally {
      setPaying(false);
    }
  }

  if (!subject) {
    return (
      <div className="page">
        <div className="container-narrow center-text">
          <p className="muted">Loading subject...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container-narrow">
        <div className="card">
          <div className="tags" style={{ marginBottom: 12 }}>
            <span className="badge">
              {papers.length} paper{papers.length === 1 ? '' : 's'}
            </span>
          </div>
          <h1>{subject.name}</h1>

          <div className="flex-between" style={{ margin: '20px 0' }}>
            <span className="price-tag" style={{ fontSize: '1.6rem' }}>
              {isFree ? 'Free' : `₹${subject.price}`}
            </span>
            {owned && <span className="badge badge-success">Purchased</span>}
            {isAdmin && <span className="badge">Admin access</span>}
          </div>

          {error && <p role="alert" style={{ marginBottom: 16 }}>{error}</p>}
          {message && <p className="alert-success" style={{ marginBottom: 16 }}>{message}</p>}

          {canViewDirectly && !folderId && <SubjectClasses subjectId={id} />}

          {canViewDirectly ? (
            papers.length === 0 && folders.length === 0 ? (
              <p className="muted">No papers have been uploaded for this subject yet.</p>
            ) : folderId ? (
              currentFolderNode ? (
                <div>
                  <p className="muted" style={{ marginBottom: 16 }}>
                    <Link to={`/papers/${id}`}>{subject.name}</Link>
                    {folderPath.map((f, i) => (
                      <span key={f.id}>
                        {' / '}
                        {i === folderPath.length - 1 ? (
                          f.name
                        ) : (
                          <Link to={`/papers/${id}/folders/${f.id}`}>{f.name}</Link>
                        )}
                      </span>
                    ))}
                  </p>

                  {currentFolderNode.papers.length === 0 && currentFolderNode.children.length === 0 ? (
                    <p className="muted">This folder is empty.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {currentFolderNode.papers.map((p) => (
                        <PaperRow key={p.id} paper={p} />
                      ))}
                      {currentFolderNode.children.map((node) => (
                        <FolderRow key={node.id} subjectId={id} node={node} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="muted">Folder not found.</p>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rootPapers.map((p) => (
                  <PaperRow key={p.id} paper={p} />
                ))}
                {rootFolders.map((node) => (
                  <FolderRow key={node.id} subjectId={id} node={node} />
                ))}
              </div>
            )
          ) : !user ? (
            <div className="center-text">
              <p className="muted">Log in to purchase this subject.</p>
              <Link to="/login" className="btn btn-block btn-lg">
                Log in
              </Link>
            </div>
          ) : isFree ? (
            <button type="button" className="btn-block btn-lg" onClick={handleGetFree} disabled={paying}>
              {paying ? 'Unlocking...' : 'Get for free'}
            </button>
          ) : pendingClaim ? (
            <div className="card" style={{ background: 'var(--bg-subtle, #f5f5f8)' }}>
              <p style={{ marginTop: 0 }}>
                <strong>Payment submitted — waiting for admin to verify.</strong>
              </p>
              <p className="muted" style={{ marginBottom: 0 }}>
                UTR: {pendingClaim.utr}. This can take a little while — please contact admin
                {upiInfo?.adminContactPhone ? ` at ${upiInfo.adminContactPhone}` : ''} for access to this
                subject once you've paid, if it's been a while.
              </p>
            </div>
          ) : !showUpiPanel ? (
            <button type="button" className="btn-block btn-lg" onClick={handleBuyClick}>
              Buy & unlock
            </button>
          ) : (
            <>
              {pendingIntent && (
                <div className="card" style={{ background: 'var(--bg-subtle, #f5f5f8)', marginBottom: 16 }}>
                  <p style={{ margin: 0 }}>
                    <strong>You started paying for this — did you complete it?</strong> If so, enter
                    your UTR below to confirm. If not, go ahead and pay now.
                  </p>
                </div>
              )}
            <form onSubmit={handleSubmitClaim}>
              <div className="center-text" style={{ marginBottom: 16 }}>
                <p style={{ marginTop: 0, marginBottom: 4 }}>
                  Pay <strong>₹{subject.price}</strong> to
                </p>
                <p style={{ marginTop: 0, fontSize: '1.1rem' }}>
                  <strong>{upiInfo?.upiId}</strong>
                </p>

                {upiUrl && (
                  <a href={upiUrl} className="btn btn-block" style={{ marginBottom: 8 }}>
                    Pay Now
                  </a>
                )}
                <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
                  On your phone, "Pay Now" opens your UPI app (GPay, PhonePe, Paytm, etc.) with the
                  amount already filled in. On a computer, scan the QR code below instead.
                </p>

                {qrDataUrl && <img src={qrDataUrl} alt="UPI payment QR code" style={{ maxWidth: 220 }} />}

                <p className="muted" style={{ fontSize: '0.85rem', marginTop: 16 }}>
                  After paying, enter the transaction reference (UTR) below.
                </p>
              </div>
              <div>
                <label htmlFor="utr">UPI transaction reference (UTR)</label>
                <input
                  id="utr"
                  type="text"
                  placeholder="e.g. 123456789012"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-block btn-lg" style={{ marginTop: 12 }} disabled={paying}>
                {paying ? 'Submitting...' : "I've paid — submit for verification"}
              </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
