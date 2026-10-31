/** Mirrors the API DTOs (see the dto folders under apps/api/src). */

export type BillingDay = 1 | 10 | 15;
export const ALLOWED_BILLING_DAYS: readonly BillingDay[] = [1, 10, 15];

export interface Charge {
  date: string;
  amount: number;
}

export interface PendingRequestSummary {
  id: string;
  referenceNumber: string;
  newBillingDay: number;
  effectiveFrom: string;
}

export interface Mortgage {
  id: string;
  mortgageNumber: string;
  productName: string;
  borrowers: string[];
  remainingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  monthlyInterest: number;
  billingDay: number;
  startDate: string;
  endDate: string;
  lastCharge: Charge | null;
  nextCharge: Charge | null;
  hasPaymentDelays: boolean;
  pendingBillingDayRequest: PendingRequestSummary | null;
}

export interface PortfolioSummary {
  totalRemainingWithFees: number;
  totalRemaining: number;
  totalMonthlyPayment: number;
  lastRepaymentDate: string | null;
  mortgageCount: number;
}

export interface Property {
  id: string;
  street: string;
  city: string;
  summary: PortfolioSummary;
  mortgages: Mortgage[];
}

export interface Customer {
  id: string;
  accountNumber: string;
  firstName: string;
  lastName: string;
  phoneMasked: string;
}

export interface Lobby {
  customer: Customer;
  summary: PortfolioSummary;
  properties: Property[];
  generatedAt: string;
  fromCache: boolean;
}

export interface RequestItemInput {
  mortgageId: string;
  newBillingDay: BillingDay;
}

export interface RequestPreview {
  effectiveFrom: string;
  feePerMortgage: number;
  totalFee: number;
  items: { mortgageId: string; previousBillingDay: number; newBillingDay: number; fee: number }[];
}

export interface RequestItem {
  mortgage: {
    id: string;
    mortgageNumber: string;
    productName: string;
    borrowers: string[];
    interestRate: number;
    monthlyInterest: number;
    propertyStreet: string;
    propertyCity: string;
  };
  previousBillingDay: number;
  newBillingDay: number;
  fee: number;
}

export interface BillingDayRequest {
  id: string;
  referenceNumber: string;
  status: 'pending' | 'applied' | 'rejected' | 'cancelled';
  submittedAt: string;
  effectiveFrom: string;
  feePerMortgage: number;
  totalFee: number;
  notifyPhoneMasked: string;
  items: RequestItem[];
  replayed: boolean;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  details?: unknown;
}
