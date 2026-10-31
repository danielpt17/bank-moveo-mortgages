import './StepDone.css';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { useRequest } from '../../api/hooks';
import { ButtonLink } from '../../components/ui/Button';
import { ErrorState, Loading } from '../../components/ui/States';
import { formatDateTime } from '../../lib/format';
import { useFocusOnMount } from '../../lib/useFocusOnMount';
import { useRequestFlow } from './RequestFlowContext';
import { RequestItemsList } from './RequestItemsList';
import { TERMS_BULLETS } from './terms';

/** Step 4 – confirmation with the reference number. Data is read back from the API by id. */
export function StepDone() {
  const { id } = useParams<{ id: string }>();
  const request = useRequest(id);
  const flow = useRequestFlow();
  const headingRef = useFocusOnMount<HTMLHeadingElement>({ title: 'הבקשה נשלחה – שינוי מועד חיוב' });

  // The request is persisted; start the next attempt with a clean slate and a new idempotency key.
  useEffect(() => {
    flow.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <section className="card done__hero" aria-labelledby="step-heading">
        <img className="done__icon" src="/illustration-done.png" alt="" width={210} height={110} />
        <div className="done__text">
          <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="done__title step-heading">
            הפעולה בוצעה בהצלחה!
          </h2>
          <p className='text-s'>בקשתך לשינוי מועד חיוב המשכנתה הועברה לטיפול הבנקאי</p>
        </div>
      </section>

      <section className="card done__summary" aria-labelledby="done-summary-title">
        <div className="done__tools">
          <h3 id="done-summary-title" className="text-m">
            סיכום
          </h3>
          <div>
            <button type="button" className="link" onClick={() => window.print()}>
              <FileDownloadOutlined style={{ fontSize: 18 }} />
              להורדה
            </button>
            <button type="button" className="link" onClick={() => window.print()}>
              <PrintOutlined style={{ fontSize: 18 }} />
              הדפסה
            </button>
          </div>
        </div>

        {request.isPending ? <Loading /> : null}
        {request.isError ? <ErrorState error={request.error} onRetry={() => void request.refetch()} /> : null}

        {request.data ? (
          <>
            <dl className="done__meta">
              <div>
                <dt className="text-s text-secondary">מספר אסמכתה</dt>
                <dd className="text-m">
                  <span className="num" data-testid="reference-number">
                    {request.data.referenceNumber}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-s text-secondary">זמן הגשת הבקשה</dt>
                <dd className="text-m">
                  <span className="num">{formatDateTime(request.data.submittedAt)}</span>
                </dd>
              </div>
            </dl>

            <RequestItemsList items={request.data.items} idPrefix="done" />
          </>
        ) : null}
      </section>

      {/* Figma: the terms bullets sit under the card, as plain text */}
      <ul className="done__terms text-s" aria-label="תנאי הבקשה">
        {TERMS_BULLETS.map((t) => (
          <li key={t.slice(0, 24)}>{t}</li>
        ))}
      </ul>

      <div className="actions">
        <div className="actions__inner">
          <ButtonLink to="/" variant="primary">
            סיום
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
