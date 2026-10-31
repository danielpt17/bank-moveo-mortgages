import './MortgageDetails.css';
import FormatListBulletedOutlined from '@mui/icons-material/FormatListBulletedOutlined';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import { useState } from 'react';
import type { Mortgage, Property } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { InfoTip } from '../../components/ui/InfoTip';
import { formatDate, formatMoney } from '../../lib/format';

const DELAY_TEXT =
  'קיימים עיכובים בתשלומי המשכנתה. יש לבצע הסדר מול הבנק באשראי או לפנות למרכז המשכנתאות';

export function MortgageDetails({ properties }: { properties: Property[] }) {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <section className="card" aria-labelledby="details-title">
      <div className="details__head">
        <h2 id="details-title" className="text-l">
          פירוט משכנתאות
        </h2>
        <Button variant="primary" size="sm">
          לקיחת משכנתה חדשה
        </Button>
      </div>

      <div className="details__tools">
        <label className="details__filter">
          <span className="visually-hidden">סינון משכנתאות</span>
          <select defaultValue="active">
            <option value="active">פעילים בלבד</option>
            <option value="all">כל המשכנתאות</option>
          </select>
        </label>
        <div className="view-toggle">
          <span id="view-label">אופן תצוגה:</span>
          <div role="group" aria-labelledby="view-label" className="view-toggle__group">
            <button
              type="button"
              className="view-toggle__btn"
              aria-pressed={view === 'grid'}
              aria-label="תצוגת כרטיסים"
              onClick={() => setView('grid')}
            >
              <GridViewOutlined style={{ fontSize: 18 }} />
            </button>
            <button
              type="button"
              className="view-toggle__btn"
              aria-pressed={view === 'list'}
              aria-label="תצוגת רשימה"
              onClick={() => setView('list')}
            >
              <FormatListBulletedOutlined style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      </div>

      {properties.map((property) => (
        <PropertyGroup key={property.id} property={property} view={view} />
      ))}
    </section>
  );
}

function PropertyGroup({ property, view }: { property: Property; view: 'grid' | 'list' }) {
  const headingId = `property-${property.id}`;
  return (
    <section className="property" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-m property__title">
        <img src="/icon-property.png" alt="" width={24} height={24} />
        {property.street}, {property.city}
      </h3>

      <div className="property__summary">
        <div className="property__stat">
          <span className="text-s property__stat-label">
            הסך הנותר להחזרי המשכנתאות:
            <InfoTip text="כולל עמלות פירעון מוקדם של הנכס." />
          </span>
          <span className="text-m">
            <span className="num">{formatMoney(property.summary.totalRemainingWithFees)}</span>
          </span>
          <a href="#help" className="link text-xs property__stat-link">
            הצג ללא עמלת פירעון מוקדם
          </a>
        </div>
        <div className="property__stat">
          <span className="text-s property__stat-label">
            תשלום חודשי קרוב:
            <InfoTip text="סכום ההחזרים החודשיים של משכנתאות הנכס." />
          </span>
          <span className="text-m">
            <span className="num">{formatMoney(property.summary.totalMonthlyPayment)}</span>
          </span>
        </div>
        <div className="property__stat">
          <span className="text-s property__stat-label">החזר אחרון ב:</span>
          <span className="text-m">
            <span className="num">
              {property.summary.lastRepaymentDate
                ? formatDate(property.summary.lastRepaymentDate)
                : '—'}
            </span>
          </span>
        </div>
      </div>

      <ul className={`mortgages mortgages--${view}`}>
        {property.mortgages.map((m) => (
          <li key={m.id}>
            <MortgageCard mortgage={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MortgageCard({ mortgage: m }: { mortgage: Mortgage }) {
  return (
    <article
      className={`mcard${m.hasPaymentDelays ? ' mcard--delayed' : ''}`}
      aria-label={`משכנתה ${m.mortgageNumber}`}
    >
      <div className="mcard__head">
        <p className="text-xs">
          <span>
            משכנתה <span className="num">{m.mortgageNumber}</span>
          </span>
          {m.hasPaymentDelays ? (
            <InfoTip text={DELAY_TEXT} label="קיימים עיכובים בתשלום – פרטים" />
          ) : null}
        </p>
        <p className="text-m">{m.productName}</p>
      </div>

      <dl className="mcard__rows">
        <div>
          <dt className="text-xs">יתרה לתשלום</dt>
          <dd className="text-s">
            <span className="num">{formatMoney(m.remainingBalance)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs">החיוב הקודם</dt>
          <dd className="text-xs">
            {m.lastCharge ? (
              <>
                <span className="text-xs text-secondary num">{formatDate(m.lastCharge.date)}</span>
                <span className="num">{formatMoney(m.lastCharge.amount)}</span>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs">החיוב הקרוב</dt>
          <dd className="text-xs">
            {m.nextCharge ? (
              <>
                <span className="text-xs text-secondary num">{formatDate(m.nextCharge.date)}</span>
                <span className="num">{formatMoney(m.nextCharge.amount)}</span>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>

      <div className="mcard__footer">
        <a href="#help" className="link">
          לצפייה במשכנתה
        </a>
      </div>
    </article>
  );
}
