import './FlowTable.css';
import type { RequestItem } from '../../api/types';
import { InfoTip } from '../../components/ui/InfoTip';
import { formatBillingDay, formatMoney, formatPercent } from '../../lib/format';

/** Figma column widths (borrowers, mortgage no., new day, fee, interest), applied as shares of the
 *  row like in step 1. */
const SUMMARY_COLUMNS = [230, 190, 190, 190, 190];
const SUMMARY_COLUMNS_TOTAL = SUMMARY_COLUMNS.reduce((a, b) => a + b, 0);

/** Grouped-by-property table used on the summary and confirmation screens. */
export function RequestItemsList({ items, idPrefix }: { items: RequestItem[]; idPrefix: string }) {
  const groups = new Map<string, RequestItem[]>();
  for (const item of items) {
    const key = `${item.mortgage.propertyStreet}, ${item.mortgage.propertyCity}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <>
      {[...groups.entries()].map(([property, rows], gi) => (
        <table key={property} className="tbl tbl--summary" id={`${idPrefix}-group-${gi}`}>
          <caption className="group__title">{property}</caption>
          <colgroup>
            {SUMMARY_COLUMNS.map((w, i) => (
              <col key={i} style={{ width: `${(w / SUMMARY_COLUMNS_TOTAL) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">שמות הלווים</th>
              <th scope="col">מספר משכנתה</th>
              <th scope="col">
                מועד חיוב חדש
                <InfoTip text="המועד החדש ייכנס לתוקף בחודש שמופיע בסיכום." />
              </th>
              <th scope="col">
                עמלה
                <InfoTip text="עמלת טיפול חד פעמית לכל משכנתה בבקשה." />
              </th>
              <th scope="col">
                ריבית
                <InfoTip text="ריבית שנתית וסכום הריבית החודשי הנוכחי." />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.mortgage.id}>
                <td data-label="שמות הלווים">
                  <ul className="tbl__lines">
                    {item.mortgage.borrowers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </td>
                <td data-label="מספר משכנתה">
                  <span className="num">{item.mortgage.mortgageNumber}</span>
                </td>
                <td data-label="מועד חיוב חדש">
                  {formatBillingDay(item.newBillingDay)}
                  <span className="visually-hidden"> (המועד הנוכחי: {formatBillingDay(item.previousBillingDay)})</span>
                </td>
                <td data-label="עמלה">
                  <span className="num">{formatMoney(item.fee)}</span>
                </td>
                <td data-label="ריבית">
                  <div className="tbl__lines">
                    <span className="num">{formatPercent(item.mortgage.interestRate)}</span>
                    <span className="text-xs text-secondary num">{formatMoney(item.mortgage.monthlyInterest)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </>
  );
}
