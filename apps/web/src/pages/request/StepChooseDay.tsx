import './StepChooseDay.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLobby } from '../../api/hooks';
import { ALLOWED_BILLING_DAYS, type BillingDay, type Mortgage } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { ErrorState, Loading } from '../../components/ui/States';
import { formatBillingDay } from '../../lib/format';
import { useFocusOnMount } from '../../lib/useFocusOnMount';
import { useRequestFlow } from './RequestFlowContext';

const ERROR_ID = 'day-error';

/** Step 2 – pick a new billing day per selected mortgage. Only 1/10/15 minus the current day. */
export function StepChooseDay() {
  const lobby = useLobby();
  const flow = useRequestFlow();
  const navigate = useNavigate();
  const [showErrors, setShowErrors] = useState(false);
  const headingRef = useFocusOnMount<HTMLHeadingElement>({ title: 'בחירת תאריך לחיוב – שינוי מועד חיוב' });

  // Guard: nothing selected (e.g. deep link) → back to step 1.
  useEffect(() => {
    if (flow.selectedIds.length === 0) void navigate('../select', { replace: true });
  }, [flow.selectedIds.length, navigate]);

  const groups =
    lobby.data?.properties
      .map((p) => ({ property: p, mortgages: p.mortgages.filter((m) => flow.selectedIds.includes(m.id)) }))
      .filter((g) => g.mortgages.length > 0) ?? [];

  const missing = flow.selectedIds.filter((id) => flow.days[id] === undefined);
  // Same pattern as step 1: after a failed attempt the button looks disabled and explains why
  const blocked = showErrors && missing.length > 0;
  const BLOCKED_TEXT = 'יש לבחור מועד חיוב חדש לכל המשכנתאות.';

  const next = () => {
    if (missing.length > 0) {
      setShowErrors(true);
      return;
    }
    void navigate('../summary');
  };

  return (
    <section className="card flow__card" aria-labelledby="step-heading">
      <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-l step-heading">
        בחירת תאריך לחיוב
      </h2>

      {lobby.isPending ? <Loading /> : null}
      {lobby.isError ? <ErrorState error={lobby.error} onRetry={() => void lobby.refetch()} /> : null}

      {groups.map(({ property, mortgages }) => (
        <section key={property.id} className="group" aria-labelledby={`day-group-${property.id}`}>
          <h3 id={`day-group-${property.id}`} className="group__title">
            {property.street}, {property.city}
          </h3>
          {/* Figma: no header row and no lines – each mortgage is a row of label-over-value cells */}
          <ul className="days">
            {mortgages.map((m) => (
              <DayRow key={m.id} mortgage={m} showError={showErrors} />
            ))}
          </ul>
        </section>
      ))}

      <div className="actions">
        <div className="actions__inner">
          <Button variant="secondary" onClick={() => void navigate('../select')}>
            לשלב הקודם
          </Button>
          <span className="tip-wrap hint action-hint">
            <Button variant="primary" onClick={next} aria-disabled={blocked || undefined} aria-describedby={blocked ? ERROR_ID : undefined}>
              לשלב הבא
            </Button>
            {blocked ? (
              <span role="tooltip" id={ERROR_ID} className="tip-bubble">
                {BLOCKED_TEXT}
              </span>
            ) : null}
          </span>
          <span role="status" className="visually-hidden">
            {blocked ? BLOCKED_TEXT : ''}
          </span>
        </div>
      </div>
    </section>
  );
}

function DayRow({ mortgage: m, showError }: { mortgage: Mortgage; showError: boolean }) {
  const flow = useRequestFlow();
  const value = flow.days[m.id];
  const options = ALLOWED_BILLING_DAYS.filter((d) => d !== m.billingDay);
  const invalid = showError && value === undefined;

  return (
    <li className="days__row">
      <div className="days__cell">
        <span className="text-s text-secondary">מספר משכנתה</span>
        <span className="num text-m">{m.mortgageNumber}</span>
      </div>
      <div className="days__cell">
        <span className="text-s text-secondary">מועד חיוב נוכחי</span>
        <span className="text-m">{formatBillingDay(m.billingDay)}</span>
      </div>
      <fieldset className="days__cell" aria-invalid={invalid || undefined}>
        <legend className="text-s text-secondary">
          מועד חיוב חדש <span className="visually-hidden">למשכנתה {m.mortgageNumber}</span>
        </legend>
        <div className="chips">
          {options.map((day) => (
            <label key={day} className="choice choice--boxed">
              <input
                type="radio"
                name={`day-${m.id}`}
                value={day}
                checked={value === day}
                onChange={() => flow.setDay(m.id, day as BillingDay)}
              />
              <span>{formatBillingDay(day)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </li>
  );
}
