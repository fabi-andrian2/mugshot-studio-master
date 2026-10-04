import { useState, useRef } from 'react';

const NumField = ({ value, onChange, onCommit, onCancel, unit = '', min, max, step = 1, label, decimals = 0 }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const touched = useRef(false);

  const fmt = (v) => decimals > 0 ? Number(v).toFixed(decimals) : String(Math.round(v));
  const clamp = (v) => {
    let n = parseFloat(v);
    if (isNaN(n)) return value;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };

  const commit = () => {
    setEditing(false);
    if (!touched.current) return;
    touched.current = false;
    const finalVal = clamp(draft);
    onChange(finalVal);
    if (onCommit) onCommit(finalVal);
  };

  const cancel = () => {
    touched.current = false;
    setEditing(false);
    if (onCancel) onCancel();
  };

  const startEdit = () => {
    touched.current = false;
    setDraft(fmt(value));
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const s = e.shiftKey ? step * 10 : step;
    const nextVal = clamp(value + (e.deltaY < 0 ? s : -s));
    onChange(nextVal);
    if (onCommit) onCommit(nextVal);
  };

  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>}
      <div
        className="relative flex items-center bg-[#1e1e1e] border border-gray-700 rounded
                   hover:border-gray-500 focus-within:border-emerald-500 transition-colors h-8"
        onWheel={onWheel}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            value={draft}
            step={step}
            onChange={e => {
              touched.current = true;
              const valStr = e.target.value;
              setDraft(valStr);
              const parsed = parseFloat(valStr);
              if (!isNaN(parsed)) {
                onChange(parsed);
              }
            }}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            className="w-full bg-transparent text-center text-xs font-mono text-white outline-none px-1"
            autoFocus
          />
        ) : (
          <div
            onClick={startEdit}
            className="w-full text-center text-xs font-mono text-white cursor-text py-1 px-1 select-none"
            title="Cliquer pour éditer · Molette pour incrémenter"
          >
            {fmt(value)}{unit && <span className="text-gray-500 ml-0.5 text-[10px]">{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default NumField;