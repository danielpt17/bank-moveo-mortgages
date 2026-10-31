import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Lobby, Mortgage } from '../../api/types';
import { FLOW_BASE } from '../../routes';
import { RequestFlowProvider } from './RequestFlowContext';
import { StepSelectMortgages } from './StepSelectMortgages';

const mortgage = (over: Partial<Mortgage>): Mortgage => ({
  id: 'm1',
  mortgageNumber: '2392345632',
  productName: 'רכישת דירה יד שניה',
  borrowers: ['אביגיל רוזנבלום', 'יוסי רוזנבלום'],
  remainingBalance: 1000,
  monthlyPayment: 1521.24,
  interestRate: 5.75,
  monthlyInterest: 173.98,
  billingDay: 10,
  startDate: '2020-01-01',
  endDate: '2045-01-01',
  lastCharge: null,
  nextCharge: null,
  hasPaymentDelays: false,
  pendingBillingDayRequest: null,
  ...over,
});

const lobby: Lobby = {
  customer: { id: 'c1', accountNumber: '401-123456', firstName: 'אביגיל', lastName: 'רוזנבלום', phoneMasked: '050-****122' },
  summary: { totalRemainingWithFees: 0, totalRemaining: 0, totalMonthlyPayment: 0, lastRepaymentDate: null, mortgageCount: 2 },
  properties: [
    {
      id: 'p1',
      street: 'רבי יוחנן הלוי 23',
      city: 'ירושלים',
      summary: { totalRemainingWithFees: 0, totalRemaining: 0, totalMonthlyPayment: 0, lastRepaymentDate: null, mortgageCount: 2 },
      mortgages: [
        mortgage({ id: 'm1' }),
        mortgage({
          id: 'm2',
          mortgageNumber: '2332349232',
          pendingBillingDayRequest: { id: 'r1', referenceNumber: '1', newBillingDay: 1, effectiveFrom: '2026-12-01' },
        }),
      ],
    },
  ],
  generatedAt: '2026-10-31T09:00:00.000Z',
  fromCache: false,
};

vi.mock('../../api/hooks', () => ({
  useLobby: () => ({ data: lobby, isPending: false, isError: false, error: null, refetch: vi.fn() }),
}));

function renderStep() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`${FLOW_BASE}/select`]}>
        <RequestFlowProvider>
          {/* nested like App.tsx, so the step's relative navigate('../day') resolves the same way */}
          <Routes>
            <Route path={FLOW_BASE}>
              <Route path="select" element={<StepSelectMortgages />} />
              <Route path="day" element={<h2>שלב 2</h2>} />
            </Route>
          </Routes>
        </RequestFlowProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => sessionStorage.clear());

describe('StepSelectMortgages', () => {
  it('blocks "next" with an explanation until a mortgage is selected', async () => {
    const user = userEvent.setup();
    renderStep();
    const next = screen.getByRole('button', { name: 'לשלב הבא' });
    await user.click(next);

    expect(next).toHaveAttribute('aria-disabled', 'true');
    // the blocked checkbox has its own (CSS-hidden) tooltip, so pick the button's by text
    expect(screen.getByRole('tooltip', { name: /לפחות משכנתה אחת/ })).toHaveTextContent(
      'יש לבחור לפחות משכנתה אחת כדי להמשיך.',
    );
    expect(screen.queryByText('שלב 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /2392345632/ }));
    expect(next).not.toHaveAttribute('aria-disabled');
    await user.click(next);
    expect(screen.getByText('שלב 2')).toBeInTheDocument();
  });

  it('a mortgage with an open request cannot be selected and says why', async () => {
    const user = userEvent.setup();
    renderStep();
    const blocked = screen.getByRole('checkbox', { name: /2332349232/ });
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    expect(blocked).toHaveAccessibleDescription('קיימת בקשה פתוחה למשכנתה זו');

    await user.click(blocked);
    expect(blocked).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'בחר הכל' }));
    expect(screen.getByRole('checkbox', { name: /2392345632/ })).toBeChecked();
    expect(blocked).not.toBeChecked();
  });

  it('moves focus to the step heading on mount', () => {
    renderStep();
    expect(screen.getByRole('heading', { level: 2, name: /לאיזה משכנתה/ })).toHaveFocus();
  });

  it('renders the mortgages as a real table with column headers', () => {
    renderStep();
    const table = screen.getByRole('table', { name: 'רבי יוחנן הלוי 23, ירושלים' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'בחירה',
      'מספר תיק',
      'שם ההלוואה',
      'שמות הלווים',
      'החזר חודשי',
      'מועד חיוב נוכחי',
      'פרטים נוספים',
    ]);
  });

  it('has no axe violations', async () => {
    const { container } = renderStep();
    // colour contrast needs a real renderer; the Playwright e2e covers it in Chromium
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
