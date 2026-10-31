import './HelpCard.css';
import type { SvgIconComponent } from '@mui/icons-material';
import CalculateOutlined from '@mui/icons-material/CalculateOutlined';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { FLOW_BASE } from '../../routes';

type TabKey = 'approvals' | 'requests' | 'calculators';

/** Tab icon: a MUI icon, or a Figma PNG export ({ src, width, height }) served from /public. */
type TabIcon = SvgIconComponent | { src: string; width: number; height: number };

interface HelpItem {
  label: string;
  icon: TabIcon;
  to?: string;
}

const REQUEST_ICON = { src: '/icon-requests.png', width: 20, height: 21 };

/** PNG glyphs are drawn through a CSS mask so they take the item's colour (coral). */
function ItemIcon({ icon }: { icon: TabIcon }) {
  if ('src' in icon) {
    const mask = `url(${icon.src}) center / contain no-repeat`;
    return <span className="help__icon" style={{ width: icon.width, height: icon.height, WebkitMask: mask, mask }} aria-hidden="true" />;
  }
  const Icon = icon;
  return <Icon style={{ fontSize: 20 }} />;
}

const TABS: { key: TabKey; label: string; icon: TabIcon; items: HelpItem[]; footer: string }[] = [
  {
    key: 'approvals',
    label: 'אישורים',
    icon: DescriptionOutlined,
    footer: 'לכל האישורים',
    items: [
      { label: 'אישור תשלומים בשנה נוכחית', icon: FileDownloadOutlined },
      { label: 'תשלומים בשנה נוכחית', icon: FileDownloadOutlined },
      { label: 'אישור תשלומים בשנים קודמות', icon: FileDownloadOutlined },
      { label: 'שיחזור מצב חשבון אחרון', icon: FileDownloadOutlined },
    ],
  },
  {
    key: 'requests',
    label: 'בקשות',
    icon: REQUEST_ICON,
    footer: 'לכל הבקשות',
    items: [
      { label: 'שינוי מועד חיוב', icon: REQUEST_ICON, to: FLOW_BASE },
      { label: 'שחרור שעבודים בהליך מזורז', icon: REQUEST_ICON },
      { label: 'הודעה מוקדמת על סילוק של הלוואת משכנתא', icon: REQUEST_ICON },
      { label: 'בקשה להפקת מכתב כוונות לסילוק הלוואה', icon: REQUEST_ICON },
    ],
  },
  {
    key: 'calculators',
    label: 'מחשבונים',
    icon: { src: '/icon-calculators.png', width: 17, height: 21 },
    footer: 'לכל המחשבונים',
    items: [
      { label: 'מחשבון הקפאת משכנתה', icon: CalculateOutlined },
      { label: 'מחשבון הקפאת משכנתה', icon: CalculateOutlined },
      { label: 'מחשבון כרטיס אשראי מובאו', icon: CalculateOutlined },
    ],
  },
];

/** "איך נוכל לעזור לך?" – only "שינוי מועד חיוב" leads somewhere in this assignment. */
export function HelpCard() {
  const [active, setActive] = useState<TabKey>('approvals'); // Figma default
  const baseId = useId();
  const tab = TABS.find((t) => t.key === active)!;

  return (
    <section className="card" id="help" aria-labelledby="help-title">
      <h2 id="help-title" className="text-l card__title help__title">
        איך נוכל לעזור לך?
      </h2>

      <div className="tabs">
        <div className="tabs__track" role="tablist" aria-label="סוגי שירות">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${baseId}-tab-${t.key}`}
            aria-selected={t.key === active}
            aria-controls={`${baseId}-panel-${t.key}`}
            tabIndex={t.key === active ? 0 : -1}
            className="tab"
            onClick={() => setActive(t.key)}
            onKeyDown={(e) => {
              const idx = TABS.findIndex((x) => x.key === active);
              // RTL: ArrowLeft moves to the next tab visually.
              const next = e.key === 'ArrowLeft' ? idx + 1 : e.key === 'ArrowRight' ? idx - 1 : null;
              if (next === null) return;
              e.preventDefault();
              const target = TABS[(next + TABS.length) % TABS.length]!;
              setActive(target.key);
              document.getElementById(`${baseId}-tab-${target.key}`)?.focus();
            }}
          >
            {'src' in t.icon ? <img src={t.icon.src} width={t.icon.width} height={t.icon.height} alt="" /> : <t.icon style={{ fontSize: 20 }} />}
            {t.label}
          </button>
        ))}
        </div>
      </div>

      <div role="tabpanel" id={`${baseId}-panel-${tab.key}`} aria-labelledby={`${baseId}-tab-${tab.key}`}>
        <ul className="help__grid">
          {tab.items.map((item, i) => (
            <li key={`${tab.key}-${i}`}>
              {item.to ? (
                <Link to={item.to} className="help__item">
                  <ItemIcon icon={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <button type="button" className="help__item">
                  <ItemIcon icon={item.icon} />
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="help__footer">
          <a href="#help" className="link">
            {tab.footer}
            <ChevronLeft style={{ fontSize: 16 }} />
          </a>
        </p>
      </div>
    </section>
  );
}
