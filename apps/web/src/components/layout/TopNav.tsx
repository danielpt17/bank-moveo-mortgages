import './TopNav.css';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Star from '@mui/icons-material/Star';

/** `menu: true` items open a dropdown in the real app and carry a chevron; the rest are plain links. */
const ITEMS: { label: string; menu?: boolean; current?: boolean }[] = [
  { label: 'ראשי' },
  { label: 'עובר ושב', menu: true },
  { label: 'מטבע חוץ', menu: true },
  { label: 'כרטיסי אשראי', menu: true },
  { label: 'פקדונות וחסכונות', menu: true },
  { label: 'שוק ההון', menu: true },
  { label: 'הלוואות', menu: true },
  { label: 'משכנתאות', menu: true, current: true },
  { label: 'סחר חוץ', menu: true },
  { label: 'אישורים וטפסים' },
  { label: 'תמונת מצב' },
];

/** Main banking navigation. Only "משכנתאות" is a real destination in this slice. */
export function TopNav() {
  return (
    <nav className="nav" aria-label="ניווט ראשי">
      <ul className="nav__list">
        {ITEMS.map((item) => (
          <li key={item.label}>
            {item.menu ? (
              <button
                type="button"
                className="nav__link"
                aria-haspopup="menu"
                aria-expanded={false}
                aria-current={item.current ? 'page' : undefined}
              >
                {item.label}
                <ExpandMore style={{ fontSize: 20 }} />
              </button>
            ) : (
              <a href="/" className="nav__link" aria-current={item.current ? 'page' : undefined}>
                {item.label}
              </a>
            )}
          </li>
        ))}
        <li>
          <a href="/" className="nav__link">
            <Star style={{ fontSize: 20, color: 'var(--secondary-600)' }} />
            מועדפים
          </a>
        </li>
      </ul>
    </nav>
  );
}
