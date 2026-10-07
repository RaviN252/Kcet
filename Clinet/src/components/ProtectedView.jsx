import { useEffect, useState } from 'react';
import './ProtectedView.css';

// Any sign of a screenshot attempt — the window losing focus, the tab going
// into the background, a snipping-tool shortcut, Print Screen, Ctrl+S, or
// Ctrl+P — blurs the page and shows a warning. Clicking anywhere clears the
// block and resumes viewing, no login required. A window losing focus to an
// OS snipping tool never fires a keydown the browser can see, so 'blur' is
// treated as a screenshot attempt too, not just an ambient tab-switch. This
// cannot stop a phone's native screenshot — the OS captures the screen
// without the page ever losing focus — so the per-page watermark baked into
// each image remains the real protection on mobile.
export default function ProtectedView({ children }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const block = () => setBlocked(true);

    function onKeyDown(e) {
      const key = e.key?.toLowerCase();
      const isScreenshotKey = key === 'printscreen' || (e.metaKey && e.shiftKey);
      const isSaveOrPrint = (e.ctrlKey || e.metaKey) && (key === 's' || key === 'p');

      if (!isScreenshotKey && !isSaveOrPrint) return;
      e.preventDefault();
      block();
    }

    function onVisibilityChange() {
      if (document.hidden) block();
    }

    window.addEventListener('blur', block);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('blur', block);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="protected-root">
      <div className={blocked ? 'protected-content protected-content-hidden' : 'protected-content'}>
        {children}
      </div>
      {blocked && (
        <div className="protected-block" onClick={() => setBlocked(false)}>
          <p className="protected-block-text">Screenshot is prohibited</p>
        </div>
      )}
    </div>
  );
}
