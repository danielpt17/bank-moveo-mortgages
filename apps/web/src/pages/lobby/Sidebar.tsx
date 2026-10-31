import './Sidebar.css';
import type { SvgIconComponent } from '@mui/icons-material';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SavingsOutlined from '@mui/icons-material/SavingsOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import WhatsApp from '@mui/icons-material/WhatsApp';
import { useState } from 'react';

type UpdateTab = 'updates' | 'status';

const UPDATE_TABS: {
  key: UpdateTab;
  label: string;
  items: { icon: SvgIconComponent; text: string; action?: string; color?: string }[];
}[] = [
  {
    key: 'updates',
    label: 'עדכונים עבורך',
    items: [
      {
        icon: NotificationsOutlined,
        text: 'כרטיס האשראי שלך מחכה להפעלה',
        action: 'להפעלת הכרטיס',
      },
      { icon: WarningAmberOutlined, text: 'מסמך חדש ממתין לחתימתך', action: 'לחתימה' },
    ],
  },
  {
    key: 'status',
    label: 'סטטוס פעולות',
    items: [{ icon: CheckCircleOutlined, text: 'אין פעולות ממתינות', color: 'var(--success)' }],
  },
];

/** Personal banker card – static demo content, outside the brief; laid out per the Figma sidebar. */
export function BankerCard() {
  const [tab, setTab] = useState<UpdateTab>('updates');

  return (
    <section className="card banker" aria-labelledby="banker-title">
      {/* Grid areas: avatar | name / role / actions at 1600+; on narrow sidebars the actions span the full width */}
      <div className="banker__who">
        <img className="banker__avatar" src="/avatar.png" alt="" width={95} height={95} />
        <h2 id="banker-title" className="text-m banker__name">
          תמר כהן
        </h2>
        <p className="text-s banker__role">בנקאית פרטיים</p>
        <div className="banker__actions">
          <a href="#help" className="link text-s">
            <RefreshOutlined style={{ fontSize: 16 }} />
            ליועץ השקעות
          </a>
          <a href="#help" className="link text-s">
            + שיחה חדשה
          </a>
          <a href="#help" className="link text-s">
            <ChatBubbleOutlineOutlined style={{ fontSize: 16 }} />
            כל השיחות
          </a>
        </div>
      </div>

      {/* Out of scope: shows the number like the design, opens nothing */}
      <button type="button" className="banker__phone text-s">
        וואטסאפ: <span className="num">076-8048860</span>
        <WhatsApp style={{ fontSize: 16, color: 'var(--success)' }} />
      </button>

      <div className="banker__updates">
        <div className="side-tabs" role="tablist" aria-label="עדכונים">
          {UPDATE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`banker-tab-${t.key}`}
              className="text-s"
              aria-selected={tab === t.key}
              aria-controls={`banker-panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => {
                const idx = UPDATE_TABS.findIndex((x) => x.key === tab);
                // RTL: ArrowLeft moves to the next tab visually.
                const next = e.key === 'ArrowLeft' ? idx + 1 : e.key === 'ArrowRight' ? idx - 1 : null;
                if (next === null) return;
                e.preventDefault();
                const target = UPDATE_TABS[(next + UPDATE_TABS.length) % UPDATE_TABS.length]!;
                setTab(target.key);
                document.getElementById(`banker-tab-${target.key}`)?.focus();
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`banker-panel-${tab}`} aria-labelledby={`banker-tab-${tab}`}>
        <ul className="updates text-xs">
          {UPDATE_TABS.find((t) => t.key === tab)!.items.map((item) => (
            <li key={item.text}>
              <span>
                <item.icon style={{ fontSize: 18, color: item.color }} />
                {item.text}
              </span>
              {item.action ? (
                <a href="#help" className="link text-s">
                  {item.action}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        </div>
      </div>

      <p className="banker__all">
        <a href="#help" className="link text-xs-medium">
          לכל העדכונים
          <ChevronLeft style={{ fontSize: 16 }} />
        </a>
      </p>
    </section>
  );
}

/** "מידע שכדאי לדעת" – static demo content, outside the brief. */
export function TipCard() {
  return (
    <section className="card tip" aria-labelledby="tip-title">
      <div className="tip__head">
        <h2 id="tip-title" className="tip__title">
          <img src="/icon-bulb.png" alt="" width={18} height={18} />
          מידע שכדאי לדעת
        </h2>
        <span className="tip__pager text-xs">
          <ChevronRight style={{ fontSize: 16 }} aria-hidden="true" />
          <span className="visually-hidden">פריט </span>
          <span className="num" aria-hidden="true">1/3</span>
          <span className="visually-hidden">1 מתוך 3</span>
          <ChevronLeft style={{ fontSize: 16 }} aria-hidden="true" />
        </span>
      </div>
      <div className="tip__body">
        <div className="tip__art" aria-hidden="true">
          <SavingsOutlined style={{ fontSize: 40 }} />
        </div>
        <div className="tip__text">
          <h3 className="text-m">הטבות למילואים</h3>
          <p className="text-s">
            אנשי מילואים ששירתו מעל 365 ימים יכולים לקבל הטבות עד לתקרה של 40,000 ש"ח. למידע נוסף יש
            לפנות למוקד
          </p>
        </div>
      </div>
      {/* Figma: the links are a footer row of their own, aligned to the end */}
      <p className="tip__links">
        <a href="#help" className="link text-xs">
          להגדלת המסגרת
        </a>
        <a href="#help" className="link text-xs">
          פניה לבנקאי בנושא
        </a>
      </p>
    </section>
  );
}
