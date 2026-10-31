import './StepSummary.css';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../api/client';
import { useCreateRequest, useLobby, useRequestPreview } from '../../api/hooks';
import type { RequestItem } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { ErrorState, Loading } from '../../components/ui/States';

import { useFocusOnMount } from '../../lib/useFocusOnMount';
import { useRequestFlow } from './RequestFlowContext';
import { RequestItemsList } from './RequestItemsList';
import { TERMS_BULLETS, TERMS_INTRO, TERMS_SIGNATURE } from './terms';


/** Step 3 – server-quoted summary, terms acceptance, idempotent submit. */
export function StepSummary() {
  const lobby = useLobby();
  const flow = useRequestFlow();
  const navigate = useNavigate();
  const create = useCreateRequest();
  const headingRef = useFocusOnMount<HTMLHeadingElement>({ title: 'סיכום ואישור – שינוי מועד חיוב' });

  const complete = flow.selectedIds.length > 0 && flow.items.length === flow.selectedIds.length;
  useEffect(() => {
    if (!complete) void navigate('../select', { replace: true });
  }, [complete, navigate]);

  const preview = useRequestPreview(flow.items, complete);

  // Build display rows from lobby data + chosen days (the quote confirms fees and the effective month).
  const items: RequestItem[] = useMemo(() => {
    if (!lobby.data || !preview.data) return [];
    const byId = new Map(
      lobby.data.properties.flatMap((p) => p.mortgages.map((m) => [m.id, { m, p }] as const)),
    );
    return preview.data.items.flatMap((q) => {
      const hit = byId.get(q.mortgageId);
      if (!hit) return [];
      return [
        {
          mortgage: {
            id: hit.m.id,
            mortgageNumber: hit.m.mortgageNumber,
            productName: hit.m.productName,
            borrowers: hit.m.borrowers,
            interestRate: hit.m.interestRate,
            monthlyInterest: hit.m.monthlyInterest,
            propertyStreet: hit.p.street,
            propertyCity: hit.p.city,
          },
          previousBillingDay: q.previousBillingDay,
          newBillingDay: q.newBillingDay,
          fee: q.fee,
        },
      ];
    });
  }, [lobby.data, preview.data]);

  // Figma: no "I agree" checkbox – pressing אישור under the terms is the acceptance
  const submit = () => {
    if (create.isPending) return;
    create.mutate(
      { items: flow.items, idempotencyKey: flow.idempotencyKey },
      {
        onSuccess: (request) => {
          // The Done step clears the wizard state; clearing it here would trip
          // this step's "incomplete → back to select" guard before navigation.
          void navigate(`../done/${request.id}`, { replace: true });
        },
      },
    );
  };

  const submitError = create.error instanceof ApiError ? create.error : null;

  return (
    <section className="card summary" aria-labelledby="step-heading">
      {/* Figma spacing: heading→text 12, intro→tables 48, table→table 24, last table→divider 32→terms */}
      <div className="summary__intro">
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-m step-heading">
          סיכום
        </h2>

      <div className="summary-text">
        <p className="text-s">
          ביקשת לשנות את מועד חיוב המשכנתה. הבקשה תועבר לבנקאי ותקבל מענה תוך x ימי עסקים.
          <br className="br-desktop" /> עם אישור העדכון, תקבל הודעה למספר הטלפון אותו תגדיר.
        </p>
        {/* Figma: question + number are one block, 8px apart; 12px to the text above and the checkbox below */}
        <div className="summary-text__phone">
          <p className="text-s-medium">לאיזה מספר לשלוח את העדכון על הבקשה?</p>
          <p className="text-s">
            <span className="num">{lobby.data?.customer.phoneMasked}</span>
          </p>
        </div>
        <label className="choice">
          <input type="checkbox" disabled />
          <span>ארצה לשנות את המספר</span>
        </label>
      </div>
      </div>

      <div className="summary__items">
        {preview.isPending && complete ? <Loading label="מחשבים עמלות ומועד תחילה…" /> : null}
        {preview.isError ? <ErrorState error={preview.error} onRetry={() => void preview.refetch()} /> : null}
        {items.length > 0 ? <RequestItemsList items={items} idPrefix="summary" /> : null}
      </div>

      <div className="terms">
        <h3 className="text-m">פירוט תנאים נוספים</h3>
        <p className="text-s text-secondary terms__note">
          <InfoOutlined style={{ fontSize: 16 }} />
          יש לעבור על כל הפרטים כדי להמשיך בתהליך
        </p>
        <div className="terms__box">
          <p>{TERMS_INTRO}</p>
          <ul>
            {TERMS_BULLETS.map((t) => (
              <li key={t.slice(0, 24)}>{t}</li>
            ))}
          </ul>
          <p className="text-s-medium">{TERMS_SIGNATURE}</p>
        </div>
      </div>

      {submitError ? (
        <div className="alert alert--error" role="alert">
          <WarningAmberOutlined style={{ fontSize: 20 }} />
          <div>
            <p className="text-strong">הבקשה לא נשלחה</p>
            <p>{describeError(submitError)}</p>
            {submitError.code === 'REQUEST_ALREADY_OPEN' ? (
              <Button variant="ghost" size="sm" onClick={() => void navigate('../select')}>
                חזרה לבחירת משכנתאות
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="actions">
        <div className="actions__inner">
          <Button variant="secondary" onClick={() => void navigate('../day')} disabled={create.isPending}>
            לשלב הקודם
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={create.isPending || !preview.data}
            aria-busy={create.isPending || undefined}
          >
            {create.isPending ? 'שולח…' : 'אישור'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function describeError(err: ApiError): string {
  switch (err.code) {
    case 'REQUEST_ALREADY_OPEN':
      return 'לאחת המשכנתאות כבר קיימת בקשה פתוחה לשינוי מועד חיוב.';
    case 'INVALID_BILLING_DAY':
      return 'מועד החיוב שנבחר אינו תקין. יש לבחור 1, 10 או 15 בחודש, השונה מהמועד הנוכחי.';
    case 'MORTGAGE_NOT_OWNED':
      return 'אחת המשכנתאות אינה שייכת לחשבון זה.';
    case 'NETWORK_ERROR':
      return 'אין חיבור לשרת. אפשר לנסות שוב – הבקשה לא תישלח פעמיים.';
    default:
      return err.message;
  }
}
