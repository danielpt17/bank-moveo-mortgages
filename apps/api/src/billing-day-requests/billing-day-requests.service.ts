import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseError } from 'pg';
import { toNumber } from '../common/money';
import { Env } from '../config/env';
import { LobbyService, maskPhone } from '../lobby/lobby.service';
import { BillingDayRequestsRepository, OwnedMortgageRow, RequestRow } from './billing-day-requests.repository';
import { BillingDayRequestDto, BillingDayRequestPreviewDto } from './dto/billing-day-request.dto';
import { BillingDayRequestItemInputDto, CreateBillingDayRequestDto } from './dto/create-billing-day-request.dto';
import { calculateEffectiveFrom, calculateTotalFee, FEE_PER_MORTGAGE_ILS, validateNewBillingDay } from './domain/billing-day.rules';

/** Names of the Postgres constraints we translate into API errors. */
const IDEMPOTENCY_CONSTRAINT = 'billing_day_requests_customer_id_idempotency_key_key';
const ONE_OPEN_PER_MORTGAGE_INDEX = 'billing_day_request_items_one_open_per_mortgage';

export type Clock = () => Date;

@Injectable()
export class BillingDayRequestsService {
  private readonly logger = new Logger(BillingDayRequestsService.name);
  private readonly timeZone: string;
  /** Overridable in tests. */
  now: Clock = () => new Date();

  constructor(
    private readonly repo: BillingDayRequestsRepository,
    private readonly lobby: LobbyService,
    config: ConfigService<Env, true>,
  ) {
    this.timeZone = config.get('BUSINESS_TIMEZONE', { infer: true });
  }

  /** Quotes effective month and fees for a candidate request without persisting anything. */
  async preview(customerId: string, items: BillingDayRequestItemInputDto[]): Promise<BillingDayRequestPreviewDto> {
    const mortgages = await this.loadAndValidate(customerId, items);
    const submittedAt = this.now();
    return {
      effectiveFrom: calculateEffectiveFrom(submittedAt, this.timeZone),
      feePerMortgage: FEE_PER_MORTGAGE_ILS,
      totalFee: calculateTotalFee(items.length),
      items: items.map((item) => ({
        mortgageId: item.mortgageId,
        previousBillingDay: mortgages.get(item.mortgageId)!.billing_day,
        newBillingDay: item.newBillingDay,
        fee: FEE_PER_MORTGAGE_ILS,
      })),
    };
  }

  /**
   * Creates a request. Safe to retry: a second call with the same Idempotency-Key
   * returns the original request (replayed = true) instead of creating another.
   */
  async create(
    customerId: string,
    idempotencyKey: string,
    dto: CreateBillingDayRequestDto,
  ): Promise<{ request: BillingDayRequestDto; created: boolean }> {
    const [existing] = await this.repo.findByIdempotencyKey(customerId, idempotencyKey);
    if (existing) {
      return { request: await this.replay(existing, dto), created: false };
    }

    const mortgages = await this.loadAndValidate(customerId, dto.items);
    const [customer] = await this.repo.findCustomerPhone(customerId);
    if (!customer) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });

    const submittedAt = this.now();
    let row: RequestRow;
    try {
      row = await this.repo.insert({
        customerId,
        idempotencyKey,
        submittedAt,
        effectiveFrom: calculateEffectiveFrom(submittedAt, this.timeZone),
        feePerMortgage: FEE_PER_MORTGAGE_ILS,
        totalFee: calculateTotalFee(dto.items.length),
        notifyPhone: customer.phone,
        items: dto.items.map((item) => ({
          mortgageId: item.mortgageId,
          previousBillingDay: mortgages.get(item.mortgageId)!.billing_day,
          newBillingDay: item.newBillingDay,
          fee: FEE_PER_MORTGAGE_ILS,
        })),
      });
    } catch (error) {
      // Two concurrent submissions can both pass the checks above; the database
      // is the final arbiter, so translate its unique violations.
      if (isUniqueViolation(error, IDEMPOTENCY_CONSTRAINT)) {
        const [raced] = await this.repo.findByIdempotencyKey(customerId, idempotencyKey);
        if (raced) return { request: await this.replay(raced, dto), created: false };
      }
      if (isUniqueViolation(error, ONE_OPEN_PER_MORTGAGE_INDEX)) {
        throw new ConflictException({
          code: 'REQUEST_ALREADY_OPEN',
          message: 'One of the mortgages already has an open billing-day request',
        });
      }
      throw error;
    }

    await this.lobby.invalidate(customerId);
    this.logger.log(`billing-day request ${row.reference_number} created for customer ${customerId}`);
    return { request: await this.toDto(row, false), created: true };
  }

  async getById(customerId: string, id: string): Promise<BillingDayRequestDto> {
    const [row] = await this.repo.findById(customerId, id);
    if (!row) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' });
    return this.toDto(row, false);
  }

  /**
   * A repeated Idempotency-Key must carry the same items; otherwise the client reused a key
   * for a different request and silently returning the old one would hide its data.
   */
  private async replay(existing: RequestRow, dto: CreateBillingDayRequestDto): Promise<BillingDayRequestDto> {
    const original = await this.toDto(existing, true);
    const key = (mortgageId: string, day: number) => `${mortgageId}:${day}`;
    const sent = new Set(dto.items.map((i) => key(i.mortgageId, i.newBillingDay)));
    const stored = new Set(original.items.map((i) => key(i.mortgage.id, i.newBillingDay)));
    const same = sent.size === stored.size && [...sent].every((k) => stored.has(k));
    if (!same) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This Idempotency-Key was already used for a request with different items',
      });
    }
    return original;
  }

  /** Ownership, allowed-day and one-open-request checks. Returns the owned mortgages by id. */
  private async loadAndValidate(
    customerId: string,
    items: BillingDayRequestItemInputDto[],
  ): Promise<Map<string, OwnedMortgageRow>> {
    const ids = items.map((i) => i.mortgageId);
    const rows = await this.repo.findOwnedMortgages(customerId, ids);
    const byId = new Map(rows.map((r) => [r.id, r]));

    const foreign = ids.filter((id) => !byId.has(id));
    if (foreign.length > 0) {
      // Deliberately the same response whether the mortgage belongs to someone else or does not exist.
      throw new ForbiddenException({
        code: 'MORTGAGE_NOT_OWNED',
        message: 'One or more mortgages do not belong to this customer',
        details: { mortgageIds: foreign },
      });
    }

    const invalid = items
      .map((item) => ({ item, result: validateNewBillingDay(byId.get(item.mortgageId)!.billing_day, item.newBillingDay) }))
      .filter(({ result }) => !result.ok)
      .map(({ item, result }) => ({ mortgageId: item.mortgageId, reason: (result as { reason: string }).reason }));
    if (invalid.length > 0) {
      throw new UnprocessableEntityException({
        code: 'INVALID_BILLING_DAY',
        message: 'New billing day must be 1, 10 or 15 and differ from the current day',
        details: { items: invalid },
      });
    }

    const alreadyOpen = rows.filter((r) => r.has_pending_request).map((r) => r.id);
    if (alreadyOpen.length > 0) {
      throw new ConflictException({
        code: 'REQUEST_ALREADY_OPEN',
        message: 'One of the mortgages already has an open billing-day request',
        details: { mortgageIds: alreadyOpen },
      });
    }

    return byId;
  }

  private async toDto(row: RequestRow, replayed: boolean): Promise<BillingDayRequestDto> {
    const items = await this.repo.findItems(row.id);
    return {
      id: row.id,
      referenceNumber: row.reference_number,
      status: row.status,
      submittedAt: new Date(row.submitted_at).toISOString(),
      effectiveFrom: row.effective_from,
      feePerMortgage: toNumber(row.fee_per_mortgage),
      totalFee: toNumber(row.total_fee),
      notifyPhoneMasked: maskPhone(row.notify_phone),
      replayed,
      items: items.map((i) => ({
        mortgage: {
          id: i.mortgage_id,
          mortgageNumber: i.mortgage_number,
          productName: i.product_name,
          borrowers: i.borrowers,
          interestRate: toNumber(i.interest_rate),
          monthlyInterest: toNumber(i.monthly_interest),
          propertyStreet: i.street,
          propertyCity: i.city,
        },
        previousBillingDay: i.previous_billing_day,
        newBillingDay: i.new_billing_day,
        fee: toNumber(i.fee),
      })),
    };
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return error instanceof DatabaseError && error.code === '23505' && error.constraint === constraint;
}
