import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { toNumber } from '../common/money';
import { Env } from '../config/env';
import { LobbyDto, MortgageDto, PortfolioSummaryDto, PropertyDto } from './dto/lobby.dto';
import { LobbyRepository, MortgageRow } from './lobby.repository';

export const lobbyCacheKey = (customerId: string): string => `lobby:v1:${customerId}`;

/** Masks a phone like 0501234122 → 050-****122. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '****';
  return `${digits.slice(0, 3)}-****${digits.slice(-3)}`;
}

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private readonly ttl: number;

  constructor(
    private readonly repo: LobbyRepository,
    private readonly cache: CacheService,
    config: ConfigService<Env, true>,
  ) {
    this.ttl = config.get('LOBBY_CACHE_TTL_SECONDS', { infer: true });
  }

  /**
   * Cache-aside: Redis first, Postgres on a miss, then write back with a TTL.
   * The key is invalidated by BillingDayRequestsService after a submission.
   */
  async getLobby(customerId: string): Promise<LobbyDto> {
    const key = lobbyCacheKey(customerId);
    const cached = await this.cache.get<LobbyDto>(key);
    if (cached) return { ...cached, fromCache: true };

    const lobby = await this.buildLobby(customerId);
    await this.cache.set(key, lobby, this.ttl);
    return lobby;
  }

  async invalidate(customerId: string): Promise<void> {
    await this.cache.del(lobbyCacheKey(customerId));
    this.logger.log(`lobby cache invalidated for customer ${customerId}`);
  }

  private async buildLobby(customerId: string): Promise<LobbyDto> {
    const [customer] = await this.repo.findCustomer(customerId);
    if (!customer) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });

    const rows = await this.repo.findActiveMortgages(customerId);
    const properties = groupByProperty(rows);

    return {
      customer: {
        id: customer.id,
        accountNumber: customer.account_number,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phoneMasked: maskPhone(customer.phone),
      },
      summary: summarise(
        properties.flatMap((p) => p.mortgages),
        properties.reduce((sum, p) => sum + (p.summary.totalRemainingWithFees - p.summary.totalRemaining), 0),
      ),
      properties,
      generatedAt: new Date().toISOString(),
      fromCache: false,
    };
  }
}

function toMortgageDto(row: MortgageRow): MortgageDto {
  return {
    id: row.id,
    mortgageNumber: row.mortgage_number,
    productName: row.product_name,
    borrowers: row.borrowers,
    remainingBalance: toNumber(row.remaining_balance),
    monthlyPayment: toNumber(row.monthly_payment),
    interestRate: toNumber(row.interest_rate),
    monthlyInterest: toNumber(row.monthly_interest),
    billingDay: row.billing_day,
    startDate: row.start_date,
    endDate: row.end_date,
    lastCharge: row.last_charge_date
      ? { date: row.last_charge_date, amount: toNumber(row.last_charge_amount) }
      : null,
    nextCharge: row.next_charge_date
      ? { date: row.next_charge_date, amount: toNumber(row.next_charge_amount) }
      : null,
    hasPaymentDelays: row.has_payment_delays,
    pendingBillingDayRequest: row.pending_request_id
      ? {
          id: row.pending_request_id,
          referenceNumber: row.pending_reference_number!,
          newBillingDay: row.pending_new_billing_day!,
          effectiveFrom: row.pending_effective_from!,
        }
      : null,
  };
}

function groupByProperty(rows: MortgageRow[]): PropertyDto[] {
  const byProperty = new Map<string, { row: MortgageRow; mortgages: MortgageDto[]; fees: number }>();
  for (const row of rows) {
    const entry = byProperty.get(row.property_id) ?? { row, mortgages: [], fees: 0 };
    entry.mortgages.push(toMortgageDto(row));
    entry.fees += toNumber(row.early_repayment_fee);
    byProperty.set(row.property_id, entry);
  }
  return [...byProperty.values()].map(({ row, mortgages, fees }) => ({
    id: row.property_id,
    street: row.street,
    city: row.city,
    summary: summarise(mortgages, fees),
    mortgages,
  }));
}

function summarise(mortgages: MortgageDto[], extraFees?: number): PortfolioSummaryDto {
  const totalRemaining = round2(mortgages.reduce((sum, m) => sum + m.remainingBalance, 0));
  const totalMonthlyPayment = round2(mortgages.reduce((sum, m) => sum + m.monthlyPayment, 0));
  const lastRepaymentDate = mortgages.reduce<string | null>(
    (latest, m) => (latest === null || m.endDate > latest ? m.endDate : latest),
    null,
  );
  return {
    totalRemaining,
    totalRemainingWithFees: round2(totalRemaining + (extraFees ?? 0)),
    totalMonthlyPayment,
    lastRepaymentDate,
    mortgageCount: mortgages.length,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
