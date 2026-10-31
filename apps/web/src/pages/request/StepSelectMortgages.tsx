import './FlowTable.css';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLobby } from '../../api/hooks';
import type { Mortgage } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { ErrorState, Loading } from '../../components/ui/States';
import { formatBillingDay, formatMoney } from '../../lib/format';
import { useFocusOnMount } from '../../lib/useFocusOnMount';
import { useRequestFlow } from './RequestFlowContext';

const ERROR_ID = 'select-error';

/** Figma column widths (file no., loan, borrowers, payment, current day). A table has no fr units
 *  and never shrinks below px columns, so they are applied as shares of the row and scale with the
 *  card; the checkbox column keeps its fixed 36px. */
const SELECT_COLUMNS = [125, 250, 182, 165, 182];
const SELECT_COLUMNS_TOTAL = SELECT_COLUMNS.reduce((a, b) => a + b, 0);

/** Step 1 – choose which mortgages to change. Mortgages with an open request cannot be selected. */
export function StepSelectMortgages() {
  const lobby = useLobby();
  const flow = useRequestFlow();
  const navigate = useNavigate();
  const [showError, setShowError] = useState(false);
  // Mobile only: rows are collapsed to file number + loan name; the chevron reveals the rest
  const [openIds, setOpenIds] = useState<string[]>([]);
  const toggleOpen = (id: string) =>
    setOpenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const headingRef = useFocusOnMount<HTMLHeadingElement>({ title: 'פרטי הבקשה – שינוי מועד חיוב' });

  const selectable = (m: Mortgage) => m.pendingBillingDayRequest === null;
  const allIds = lobby.data?.properties.flatMap((p) => p.mortgages.filter(selectable).map((m) => m.id)) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => flow.selectedIds.includes(id));

  // After a failed attempt the button looks disabled and explains why in a tooltip (hover/focus)
  const blocked = showError && flow.selectedIds.length === 0;

  const next = () => {
    if (flow.selectedIds.length === 0) {
      setShowError(true);
      return;
    }
    void navigate('../day');
  };

  return (
    <section className="card flow__card" aria-labelledby="step-heading">
      <div className="group__head">
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-l step-heading">
          לאיזה משכנתה תרצה לשנות את מועד החיוב?
        </h2>
        {lobby.data ? (
          <button type="button" className="link" onClick={() => flow.setSelected(allSelected ? [] : allIds)}>
            {allSelected ? 'נקה בחירה' : 'בחר הכל'}
          </button>
        ) : null}
      </div>

      {lobby.isPending ? <Loading /> : null}
      {lobby.isError ? <ErrorState error={lobby.error} onRetry={() => void lobby.refetch()} /> : null}

      {lobby.data?.properties.map((property) => (
        <table key={property.id} className="tbl tbl--select">
          <caption className="group__title">
            {property.street}, {property.city}
          </caption>
          <colgroup>
            <col className="tbl__col-check" />
            {SELECT_COLUMNS.map((w, i) => (
              <col key={i} style={{ width: `${(w / SELECT_COLUMNS_TOTAL) * 100}%` }} />
            ))}
            <col className="tbl__col-more" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="tbl__check">
                <span className="visually-hidden">בחירה</span>
              </th>
              <th scope="col">מספר תיק</th>
              <th scope="col">שם ההלוואה</th>
              <th scope="col">שמות הלווים</th>
              <th scope="col">החזר חודשי</th>
              <th scope="col">מועד חיוב נוכחי</th>
              <th scope="col" className="tbl__more">
                <span className="visually-hidden">פרטים נוספים</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {property.mortgages.map((m) => {
              const checked = flow.selectedIds.includes(m.id);
              const disabled = !selectable(m);
              const inputId = `select-${m.id}`;
              const open = openIds.includes(m.id);
              return (
                <tr
                  key={m.id}
                  className={[disabled ? 'tbl__row--disabled' : '', open ? 'tbl__row--open' : ''].join(' ').trim() || undefined}
                >
                  <td className="tbl__check">
                    {/* aria-disabled (not disabled) so the box can still be hovered/focused to show why */}
                    <span className="tip-wrap hint">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        aria-disabled={disabled || undefined}
                        aria-describedby={disabled ? `${inputId}-why` : undefined}
                        onChange={() => {
                          if (disabled) return;
                          flow.toggle(m.id);
                          setShowError(false);
                        }}
                      />
                      {disabled ? (
                        <span role="tooltip" id={`${inputId}-why`} className="tip-bubble">
                          קיימת בקשה פתוחה למשכנתה זו
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td data-label="מספר תיק">
                    <label htmlFor={inputId} className="num">
                      {m.mortgageNumber}
                    </label>
                  </td>
                  <td data-label="שם ההלוואה">{m.productName}</td>
                  <td data-label="שמות הלווים">
                    <ul className="tbl__lines">
                      {m.borrowers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </td>
                  <td data-label="החזר חודשי">
                    <span className="num">{formatMoney(m.monthlyPayment)}</span>
                  </td>
                  <td data-label="מועד חיוב נוכחי">{formatBillingDay(m.billingDay)}</td>
                  <td className="tbl__more">
                    <button
                      type="button"
                      className="tbl__more-btn"
                      aria-expanded={open}
                      aria-label={`פרטים נוספים למשכנתה ${m.mortgageNumber}`}
                      onClick={() => toggleOpen(m.id)}
                    >
                      <ExpandMore style={{ fontSize: 24 }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}

      <div className="actions">
        <div className="actions__inner">
          <span className="tip-wrap hint action-hint">
            <Button variant="primary" onClick={next} aria-disabled={blocked || undefined} aria-describedby={blocked ? ERROR_ID : undefined}>
              לשלב הבא
            </Button>
            {blocked ? (
              <span role="tooltip" id={ERROR_ID} className="tip-bubble">
                יש לבחור לפחות משכנתה אחת כדי להמשיך.
              </span>
            ) : null}
          </span>
          {/* Announces the reason to screen readers right after the failed click */}
          <span role="status" className="visually-hidden">
            {blocked ? 'יש לבחור לפחות משכנתה אחת כדי להמשיך.' : ''}
          </span>
        </div>
      </div>
    </section>
  );
}
