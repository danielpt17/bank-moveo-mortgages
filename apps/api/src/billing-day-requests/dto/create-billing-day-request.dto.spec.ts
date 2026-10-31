import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateBillingDayRequestDto } from './create-billing-day-request.dto';

/** Request-body validation: what the API refuses before any business logic runs. */
const M1 = 'aaaaaaaa-0000-4000-8000-000000000001';

async function errorsFor(body: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateBillingDayRequestDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const flatten = (e: (typeof errors)[number]): string[] => [
    ...Object.values(e.constraints ?? {}),
    ...(e.children ?? []).flatMap(flatten),
  ];
  return errors.flatMap(flatten);
}

describe('CreateBillingDayRequestDto', () => {
  it('accepts a well-formed body', async () => {
    expect(await errorsFor({ items: [{ mortgageId: M1, newBillingDay: 10 }] })).toEqual([]);
  });

  it('rejects an empty list', async () => {
    expect(await errorsFor({ items: [] })).not.toEqual([]);
  });

  it('rejects a billing day outside 1/10/15', async () => {
    expect(await errorsFor({ items: [{ mortgageId: M1, newBillingDay: 5 }] })).not.toEqual([]);
    expect(await errorsFor({ items: [{ mortgageId: M1, newBillingDay: '10' }] })).not.toEqual([]);
  });

  it('rejects a mortgage id that is not a UUID', async () => {
    expect(await errorsFor({ items: [{ mortgageId: '2392345632', newBillingDay: 10 }] })).not.toEqual([]);
  });

  it('rejects the same mortgage twice in one request', async () => {
    expect(
      await errorsFor({
        items: [
          { mortgageId: M1, newBillingDay: 10 },
          { mortgageId: M1, newBillingDay: 15 },
        ],
      }),
    ).not.toEqual([]);
  });

  it('rejects unknown fields (no termsAccepted any more)', async () => {
    expect(await errorsFor({ items: [{ mortgageId: M1, newBillingDay: 10 }], termsAccepted: true })).not.toEqual([]);
  });
});
