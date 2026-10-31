import './RequestFlowLayout.css';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import Close from '@mui/icons-material/Close';
import HeadsetMicOutlined from '@mui/icons-material/HeadsetMicOutlined';
import { Link, Outlet, useLocation } from 'react-router';
import { useLobby } from '../../api/hooks';
import { AppHeader } from '../../components/layout/AppHeader';
import { HeroWave } from '../../components/layout/HeroWave';

export const STEPS = [
  { path: 'select', label: 'פרטי הבקשה' },
  { path: 'day', label: 'בחירת תאריך לחיוב' },
  { path: 'summary', label: 'סיכום ואישור' },
] as const;

export function useCurrentStep(): number {
  const { pathname } = useLocation();
  const last = pathname.split('/').filter(Boolean);
  if (pathname.includes('/done/')) return STEPS.length; // 3 = finished
  return Math.max(
    0,
    STEPS.findIndex((s) => s.path === last[last.length - 1]),
  );
}

/** Shared chrome for the four flow screens: header, title, exit link, side card, outlet. */
export function RequestFlowLayout() {
  const lobby = useLobby();
  const step = useCurrentStep();
  const done = step >= STEPS.length;

  return (
    <>
      <a href="#main" className="skip-link">
        דלג לתוכן הראשי
      </a>
      <AppHeader variant="flow" customer={lobby.data?.customer} />
      <HeroWave tall />

      <main id="main" className="flow">
        <div className="flow__grid">
          {/* Title, subtitle, step label + segments and the exit link. Desktop: title and subtitle on
              their own rows, step row under them with the exit at the end. Mobile: exit on top, centred. */}
          <div className="flow__head">
            {!done ? (
              <Link to="/" className="link flow__exit">
                <Close style={{ fontSize: 18 }} />
                יציאה
              </Link>
            ) : null}
            <h1 className="flow__title">בקשה לשינוי מועד חיוב המשכנתה</h1>
            {!done ? (
              <div className="stepbar">
                <span className="stepbar__label">{STEPS[step]?.label}</span>
                <div className="stepbar__segments" aria-hidden="true">
                  {STEPS.map((s, i) => (
                    <span
                      key={s.path}
                      data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
                    />
                  ))}
                </div>
                <span className="visually-hidden">
                  שלב {step + 1} מתוך {STEPS.length}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flow__main">
            <Outlet />
          </div>

          <aside className="flow__aside" aria-label="עזרה ומידע על התהליך">
            <div className="card side-help">
              <div className="side-help__who">
                <span className="side-help__avatar" aria-hidden="true">
                  <HeadsetMicOutlined style={{ fontSize: 40 }} />
                </span>
                <div>
                  <p className="text-m">מרכז שירות הלקוחות</p>
                  <a href="#main" className="link text-xs">
                    + פנייה דיגיטלית לשירות
                  </a>
                </div>
              </div>

              {step < 2 ? (
                <>
                  <p className="side-help__box">אנחנו איתך לאורך התהליך</p>
                  <p className="text-xs" style={{ textAlign: 'center' }}>
                    סיכום השלבים שעברת וטיפים רלוונטים יופיעו כאן במהלך התהליך
                  </p>
                </>
              ) : (
                <>
                  <p className="side-help__box">סיכום תהליך</p>
                  <ul className="side-help__steps" aria-label="שלבים שהושלמו">
                    {STEPS.filter((_, i) => i < step).map((s) => (
                      <li key={s.path}>
                        <CheckCircleOutlined style={{ fontSize: 18 }} />
                        {s.label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
