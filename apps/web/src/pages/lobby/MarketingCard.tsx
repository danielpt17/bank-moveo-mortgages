import './MarketingCard.css';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Close from '@mui/icons-material/Close';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';

/** Static placeholder for the Figma "תוכן שיווקי" card – outside the brief, kept for layout fidelity. */
export function MarketingCard() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <section className="card" aria-labelledby="promo-heading">
      <h2 id="promo-heading" className="text-m promo__heading">
        <img src="/icon-bulb.png" alt="" width={22} height={22} />
        תוכן שיווקי
      </h2>

      <div className="promo">
        <button
          type="button"
          className="promo__close"
          aria-label="סגור את ההצעה"
          onClick={() => setDismissed(true)}
        >
          <Close style={{ fontSize: 16 }} />
        </button>
        <p className="text-l">פיקדון לי'צי בריבית מוגדלת</p>
        <p className="text-s promo__text">
          פתחו פיקדון לי'צי לטווח זמן בינוני (3 חודשים עד שנה) ותוכלו להינות מריבית מיוחדת של 3.5%
          עד תום התקופה!
        </p>
        <div className="promo__actions">
          <Button variant="primary">יצירת פיקדון</Button>
          <a href="#help" className="link text-s-medium">
            אשמח להתייעץ עם בנקאי
          </a>
        </div>
      </div>

      {/* Decorative: a single static slide, the pager only mirrors the design */}
      <div className="promo__pager" aria-hidden="true">
        <ChevronRight style={{ fontSize: 24 }} />
        <span className="dot" />
        <span className="dot" />
        <span className="dot dot--on" />
        <span className="dot" />
        <span className="dot" />
        <ChevronLeft style={{ fontSize: 24 }} />
      </div>
    </section>
  );
}
