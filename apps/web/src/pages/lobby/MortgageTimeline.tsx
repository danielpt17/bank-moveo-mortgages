import './MortgageTimeline.css';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useEffect, useId, useRef, useState } from 'react';
import type { Mortgage, Property } from '../../api/types';
import { formatDate, formatLocalDate } from '../../lib/format';

const COLORS = ['blue', 'coral'] as const;
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const yearOf = (iso: string) => Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12;

/** Rows shown when collapsed (Figma shows 5: the last one faded as a hint that more exist). */
const COLLAPSED_ROWS = 5;

/**
 * "תמונת מצב המשכנתאות שלי": one bar per mortgage from start to end date, grouped by
 * property, with a "you are here" marker. The chart reads left→right (years ascend),
 * so it is an LTR island inside the RTL page. Each bar is a button: hover/focus shows
 * the tooltip, and its aria-label carries the same data for screen readers.
 */
export function MortgageTimeline({ properties }: { properties: Property[] }) {
  const all = properties.flatMap((p) => p.mortgages.map((m) => ({ property: p, mortgage: m })));
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const tipId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(0);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setPlotWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  if (all.length === 0) return null;

  const now = new Date();
  const nowYear = now.getFullYear() + now.getMonth() / 12;
  const minYear = Math.floor(Math.min(...all.map((x) => yearOf(x.mortgage.startDate)), nowYear) / 2) * 2;
  const lastYear = Math.max(...all.map((x) => yearOf(x.mortgage.endDate)), nowYear);

  // Year labels every 2 years as in Figma, widened until each label gets at least 56px of the
  // track. The axis end rounds up to a whole step, so the last label is the last year
  // (the axis is a space-between flex row and must match the bars' 0%..100%).
  const segments = (step: number) => Math.ceil((lastYear - minYear) / step);
  const step = [2, 4, 6, 8, 10].find((s) => plotWidth === 0 || plotWidth / segments(s) >= 56) ?? 10;
  const maxYear = minYear + segments(step) * step;
  const pct = (year: number) => ((year - minYear) / (maxYear - minYear)) * 100;

  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y += step) years.push(y);

  const nowPct = pct(nowYear);

  // Collapsed: the first COLLAPSED_ROWS rows across all properties, the last of them faded.
  // Properties that get no rows are left out entirely (label included).
  const collapsible = all.length > COLLAPSED_ROWS;
  let budget = expanded || !collapsible ? Infinity : COLLAPSED_ROWS;
  const groups = properties.flatMap((p) => {
    const rows = p.mortgages.slice(0, Math.max(0, Math.min(p.mortgages.length, budget)));
    budget -= rows.length;
    return rows.length ? [{ p, rows, previewLast: budget === 0 && !expanded && collapsible }] : [];
  });

  const describe = (p: Property, m: Mortgage) =>
    `${p.street}, ${p.city}: ${m.productName}, משכנתה ${m.mortgageNumber}, מ-${formatDate(m.startDate)} עד ${formatDate(m.endDate)}`;

  return (
    <section className="card" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="text-xl card__title timeline__title">
        תמונת מצב המשכנתאות שלי
      </h2>

      <div className="timeline" dir="ltr">
        <div className="timeline__labels" aria-hidden="true">
          {groups.map(({ p, rows }) => (
            <div key={p.id} className="timeline__label" dir="rtl" style={{ height: rows.length * 32 }}>
              <span>{p.street}</span>
              <span>{p.city}</span>
            </div>
          ))}
        </div>

        <div className="timeline__plot">
          {/* Bars live in a track inset by half a year label, so 0%/100% sit on the first/last label centres */}
          <div className="timeline__track" ref={plotRef}>
          <div className="timeline__now" style={{ left: `${nowPct}%` }} aria-hidden="true">
            <span className="timeline__now-title">אתה כאן</span>
            <span className="timeline__now-date num">
              {WEEKDAYS[now.getDay()]}, {formatLocalDate(now.toISOString())}
            </span>
          </div>
          <div className="timeline__now-line" style={{ left: `${nowPct}%` }} />

          <div className="timeline__rows">
            {groups.map(({ p, rows, previewLast }, pi) => (
              <div key={p.id} className={`timeline__group timeline__group--${COLORS[pi % COLORS.length]}`}>
                {rows.map((m, i) => {
                  const s = pct(yearOf(m.startDate));
                  const e = pct(yearOf(m.endDate));
                  const n = Math.min(Math.max(nowPct, s), e);
                  const isActive = active === m.id;
                  if (previewLast && i === rows.length - 1) {
                    // Faded hint that more bars exist; not interactive, the expand button reveals them.
                    return (
                      <div key={m.id} className="timeline__row timeline__row--preview" aria-hidden="true">
                        <span className="timeline__bar-soft" style={{ left: `${s}%`, width: `${e - s}%` }} />
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="timeline__row">
                      <button
                        type="button"
                        className="timeline__bar"
                        style={{ left: `${s}%`, width: `${e - s}%` }}
                        aria-label={describe(p, m)}
                        aria-describedby={isActive ? tipId : undefined}
                        onMouseEnter={() => setActive(m.id)}
                        onMouseLeave={() => setActive(null)}
                        onFocus={() => setActive(m.id)}
                        onBlur={() => setActive(null)}
                      >
                        <span className="timeline__bar-soft" />
                        <span className="timeline__bar-strong" style={{ width: `${((n - s) / (e - s)) * 100}%` }} />
                      </button>
                      {isActive ? (
                        <div
                          role="tooltip"
                          id={tipId}
                          className="timeline__tip"
                          dir="rtl"
                          style={e > 60 ? { right: `${100 - e}%` } : { left: `${e}%` }}
                        >
                          <span className="timeline__tip-name">{m.productName}</span>
                          <span>
                            משכנתה <span className="num">{m.mortgageNumber}</span>
                          </span>
                          <span className="timeline__tip-label">תאריך התחלה</span>
                          <span className="num">{formatDate(m.startDate)}</span>
                          <span className="timeline__tip-label">תאריך סיום</span>
                          <span className="num">{formatDate(m.endDate)}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          </div>

          <div className="timeline__axis" aria-hidden="true">
            {years.map((y) => (
              <span key={y} className="timeline__year num">
                {y}
              </span>
            ))}
          </div>
        </div>
      </div>

      {collapsible ? (
        <p className="timeline__expand">
          <button type="button" className="link timeline__expand-btn" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'צמצום התיקים' : 'הרחבה לכל התיקים'}
            <ExpandMore style={{ fontSize: 20, transform: expanded ? 'rotate(180deg)' : undefined }} />
          </button>
        </p>
      ) : null}
    </section>
  );
}
