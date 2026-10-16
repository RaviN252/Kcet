import { useEffect, useState } from 'react';
import api from '../api/client';
import './SubjectClasses.css';

// How often to check whether the admin has started/ended a live class.
const LIVE_POLL_MS = 30 * 1000;

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function ClassPlayer({ videoId, title, watermark }) {
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
  return (
    <div className="class-player">
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      {/* Drifts around the frame so a screen-recorded copy shows who leaked it. */}
      <div className="class-watermark" aria-hidden="true">
        {watermark}
      </div>
    </div>
  );
}

// Live class + recorded classes for a subject the user already has access to.
export default function SubjectClasses({ subjectId }) {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api
        .get(`/classes/${subjectId}`)
        .then((res) => !cancelled && setData(res.data))
        .catch(() => !cancelled && setData(null));
    }
    load();
    const timer = setInterval(load, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [subjectId]);

  if (!data || (!data.live && data.recordings.length === 0)) return null;

  const selected = data.recordings.find((r) => r.id === selectedId);

  return (
    <div className="subject-classes">
      {data.live && (
        <section>
          <h2>
            <span className="badge badge-live">● LIVE</span> {data.live.title}
          </h2>
          <p className="muted">Started {formatDateTime(data.live.startedAt)}</p>
          <ClassPlayer videoId={data.live.youtubeVideoId} title={data.live.title} watermark={data.watermark} />
        </section>
      )}

      {data.recordings.length > 0 && (
        <section>
          <h2>Recorded classes ({data.recordings.length})</h2>
          {selected && (
            <div style={{ marginBottom: 16 }}>
              <h3>{selected.title}</h3>
              <ClassPlayer videoId={selected.youtubeVideoId} title={selected.title} watermark={data.watermark} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.recordings.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`folder-row class-row ${r.id === selectedId ? 'class-row-active' : ''}`}
                onClick={() => setSelectedId(r.id)}
              >
                <span>▶ {r.title}</span>
                <span className="muted">{formatDateTime(r.startedAt)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
