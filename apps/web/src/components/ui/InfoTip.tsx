import './InfoTip.css';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Accessible tooltip: a real button toggles the bubble, the bubble is linked via
 * aria-describedby, Escape closes it, and hover opens it as a convenience.
 */
export function InfoTip({ text, label = 'מידע נוסף' }: { text: string; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span
      className="tip-wrap"
      ref={wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <InfoOutlined style={{ fontSize: 16 }} /> {/* Figma 16×16 */}
      </button>
      {open ? (
        <span role="tooltip" id={id} className="tip-bubble">
          {text}
        </span>
      ) : null}
    </span>
  );
}
