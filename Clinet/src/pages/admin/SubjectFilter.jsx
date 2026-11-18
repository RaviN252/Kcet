import { useEffect, useRef, useState } from 'react';

// Multi-select subject filter with its own search box.
// value: [] = all subjects, ['none'] = no subject purchased, otherwise subject ids (strings).
export default function SubjectFilter({ subjects, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const noneSelected = value.length === 1 && value[0] === 'none';
  const selectedIds = noneSelected ? [] : value;
  const q = query.trim().toLowerCase();
  const visible = q ? subjects.filter((s) => s.name.toLowerCase().includes(q)) : subjects;

  function toggle(id) {
    const key = String(id);
    onChange(selectedIds.includes(key) ? selectedIds.filter((v) => v !== key) : [...selectedIds, key]);
  }

  let label = 'All subjects';
  if (noneSelected) label = 'No subject purchased';
  else if (selectedIds.length === 1) {
    label = subjects.find((s) => String(s.id) === selectedIds[0])?.name || '1 subject';
  } else if (selectedIds.length > 1) label = `${selectedIds.length} subjects selected`;

  return (
    <div className="subject-filter" ref={rootRef}>
      <button
        type="button"
        className={`subject-filter-trigger ${value.length ? 'is-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="subject-filter-label">{label}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="subject-filter-panel">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search subjects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search subjects"
          />

          <div className="subject-filter-list" role="listbox" aria-multiselectable="true">
            {visible.length === 0 && <p className="muted subject-filter-empty">No subjects match.</p>}
            {visible.map((s) => (
              <label key={s.id} className="subject-filter-option">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(String(s.id))}
                  onChange={() => toggle(s.id)}
                />
                <span className="subject-filter-name">{s.name}</span>
                <span className="muted">{s.purchaseCount}</span>
              </label>
            ))}
            {!q && (
              <label className="subject-filter-option subject-filter-none">
                <input
                  type="checkbox"
                  checked={noneSelected}
                  onChange={() => onChange(noneSelected ? [] : ['none'])}
                />
                <span className="subject-filter-name">No subject purchased</span>
              </label>
            )}
          </div>

          <div className="subject-filter-footer">
            <button type="button" className="subject-filter-clear" onClick={() => onChange([])} disabled={!value.length}>
              Clear
            </button>
            <button type="button" className="btn-sm" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
