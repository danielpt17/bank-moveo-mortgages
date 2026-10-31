import './AppHeader.css';
import type { SvgIconComponent } from '@mui/icons-material';
import AccessibilityNewOutlined from '@mui/icons-material/AccessibilityNewOutlined';
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import MailOutlined from '@mui/icons-material/MailOutlined';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import Badge from '@mui/material/Badge';
import { Fragment, useEffect } from 'react';
import { Link } from 'react-router';
import type { Customer } from '../../api/types';
import { fullName } from '../../lib/format';

const TOOLS: {
  icon: SvgIconComponent;
  label: string;
  unread?: boolean;
  circled?: boolean;
  mirror?: boolean;
  dividerAfter?: boolean;
}[] = [
  { icon: SearchOutlined, label: 'חיפוש' },
  { icon: AccountCircleOutlined, label: 'אזור אישי' },
  { icon: MailOutlined, label: 'הודעות', unread: true },
  { icon: SettingsOutlined, label: 'הגדרות', dividerAfter: true },
  { icon: LanguageOutlined, label: 'שפה' },
  { icon: AccessibilityNewOutlined, label: 'נגישות', circled: true },
  // Directional glyph: MUI icons are LTR, so the exit arrow is mirrored for RTL.
  { icon: LogoutOutlined, label: 'יציאה מהחשבון', mirror: true },
];

/**
 * Top bar. `variant="lobby"` shows the account chip and tool icons (lobby design);
 * `variant="flow"` is the slimmer bar used inside the request flow.
 */
export function AppHeader({
  customer,
  variant,
}: {
  customer?: Customer;
  variant: 'lobby' | 'flow';
}) {
  const name = customer ? fullName(customer) : '';

  // Mobile browsers tint their own bar with theme-color, so the wave "continues" under the phone's
  // status bar on the lobby and the bar is white in the flow (Figma). Desktop keeps the white meta.
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media]');
    if (meta) meta.content = variant === 'lobby' ? '#f57a67' : '#ffffff';
  }, [variant]);

  return (
    <header className={`header header--${variant}`}>
      {/* Mobile (< 1024): account pill, then the bell at the end (left). Lobby: white over the coral wave;
          flow: peach on a white bar (Figma) */}
      <div className="header__mobile">
        {/* No aria-label: the visible name + account number is the accessible name (axe label-content-name-mismatch).
            Rendered once the customer is known, so the pill never reads as an empty "•". */}
        {customer ? (
          <button type="button" className="header__pill text-xs">
            {variant === 'flow' ? <PersonOutlineOutlined style={{ fontSize: 20, color: 'var(--accent-600)' }} /> : null}
            <span className="header__pill-text">
              {name} • <span className="num">{customer.accountNumber}</span>
            </span>
            <ExpandMore style={{ fontSize: 20 }} />
          </button>
        ) : null}
        <button type="button" className="header__bell" aria-label="התראות">
          <NotificationsOutlined style={{ fontSize: 22 }} />
        </button>
      </div>

      {/* Desktop (≥ 1024) */}
      <div className="header__row">
        <Link to="/" className="header__logo" aria-label="בנק מובאו – דף הבית של המשכנתאות">
          <img src="/logo-stacked.svg" alt="" width={292} height={203} />
        </Link>

        {variant === 'lobby' ? (
          <>
            <div className="header__account">
              <img className="avatar" src="/avatar.png" alt="" width={30} height={30} />
              <span className="header__account-text">
                <span className="header__account-label">חשבון פרטי</span>
                {name} • <span className="num">{customer?.accountNumber}</span>
              </span>
              <ExpandMore style={{ fontSize: 18 }} className="header__account-chevron" />
            </div>
            <div className="header__tools">
              {TOOLS.map((t) => (
                <Fragment key={t.label}>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t.unread ? `${t.label} – יש הודעות שלא נקראו` : t.label}
                  >
                    {t.unread ? (
                      // Figma: outlined envelope with a red unread dot. A single-path icon
                      // can't carry a second colour, so the dot is a Badge overlay.
                      <Badge variant="dot" color="error" overlap="circular">
                        <t.icon style={{ fontSize: 28 }} />
                      </Badge>
                    ) : t.circled ? (
                      // Universal accessibility symbol (person inside a circle) – not in MUI, so composed.
                      <span className="icon-circled">
                        <t.icon style={{ fontSize: 20 }} />
                      </span>
                    ) : (
                      <t.icon
                        style={{ fontSize: 28, transform: t.mirror ? 'scaleX(-1)' : undefined }}
                      />
                    )}
                  </button>
                  {t.dividerAfter ? <span className="header__divider" /> : null}
                </Fragment>
              ))}
            </div>
          </>
        ) : (
          // Flow header (Figma): bordered account box, bare language switch, user icon + name
          <div className="header__tools">
            <button type="button" className="header__select text-xs">
              <span>מלון ישראל</span>
              <span className="header__select-divider" aria-hidden="true" />
              <span>כל החשבונות</span>
              <ExpandMore style={{ fontSize: 18 }} />
            </button>
            <button type="button" className="header__lang text-xs" aria-label="שפה: עברית">
              עברית
              <ExpandMore style={{ fontSize: 18 }} />
            </button>
            {name ? (
              <span className="header__user text-s">
                <span className="header__user-icon">
                  <AccountCircleOutlined style={{ fontSize: 28 }} />
                  <span className="header__user-badge" aria-hidden="true">
                    +2
                  </span>
                </span>
                {name}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
