import './PortfolioSummary.css';
import CachedIcon from '@mui/icons-material/Cached';
import type { PortfolioSummary as Summary } from '../../api/types';
import { InfoTip } from '../../components/ui/InfoTip';
import { formatDate, formatLocalDate, formatMoney, formatTime } from '../../lib/format';

export function PortfolioSummary({ summary, generatedAt }: { summary: Summary; generatedAt: string }) {
  return (
    <section className="card" aria-labelledby="summary-title">
      <div className="summary__meta">
        <h2 id="summary-title" className="text-m card__title summary__title">
          <img src="/icon-mortgages.png" alt="" width={38} height={38} />
          משכנתאות
        </h2>
        <span className="text-s summary__updated">
          <CachedIcon style={{ fontSize: 24 }} />
          <span>
            מעודכן לתאריך: <span className="num">{formatLocalDate(generatedAt)}</span>{' '}
            <span className="num">({formatTime(generatedAt)})</span>
          </span>
        </span>
      </div>

      <dl className="summary__figures">
        <div className="summary__item">
          <dt className="text-m-regular">
            הסך הנותר להחזר (עם עמלות)
            <InfoTip text="היתרה לסילוק מלא כולל עמלות פירעון מוקדם." />
          </dt>
          <dd className="text-xl">
            <span className="num">{formatMoney(summary.totalRemainingWithFees)}</span>
          </dd>
        </div>
        <div className="summary__item">
          <dt className="text-m-regular">
            הסך הנותר להחזר
            <InfoTip text="סכום יתרות הקרן של כל המשכנתאות הפעילות." />
          </dt>
          <dd className="text-xl">
            <span className="num">{formatMoney(summary.totalRemaining)}</span>
          </dd>
        </div>
        <div className="summary__item">
          <dt className="text-m-regular">
            תשלום חודשי נוכחי משוקלל
            <InfoTip text="סכום ההחזרים החודשיים של כל המשכנתאות." />
          </dt>
          <dd className="text-xl">
            <span className="num">{formatMoney(summary.totalMonthlyPayment)}</span>
          </dd>
        </div>
        <div className="summary__item">
          <dt className="text-m-regular">החזר אחרון ב</dt>
          <dd className="text-xl">
            <span className="num">{summary.lastRepaymentDate ? formatDate(summary.lastRepaymentDate) : '—'}</span>
          </dd>
        </div>
      </dl>

      <div className="summary__notes">
        <p>
          להפקה של אישורים ומסמכים (כגון הפקת אישור יתרות) יש לעבור לאזור <a href="#help">אישורים ובקשות</a>
        </p>
        <p>
          מחפש לסלק משכנתה? למידע על <a href="#help">תהליך סילוק משכנתה</a>
        </p>
      </div>
    </section>
  );
}
