import { ApiProperty } from '@nestjs/swagger';

export class RequestItemMortgageDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '2392345632' }) mortgageNumber: string;
  @ApiProperty({ example: 'רכישת דירה יד שניה' }) productName: string;
  @ApiProperty({ type: [String] }) borrowers: string[];
  @ApiProperty({ example: 5.75 }) interestRate: number;
  @ApiProperty({ example: 173.98 }) monthlyInterest: number;
  @ApiProperty({ example: 'רבי יוחנן הלוי 23' }) propertyStreet: string;
  @ApiProperty({ example: 'ירושלים' }) propertyCity: string;
}

export class BillingDayRequestItemDto {
  @ApiProperty({ type: RequestItemMortgageDto }) mortgage: RequestItemMortgageDto;
  @ApiProperty({ example: 1 }) previousBillingDay: number;
  @ApiProperty({ example: 10 }) newBillingDay: number;
  @ApiProperty({ example: 5.44 }) fee: number;
}

export class BillingDayRequestDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '6565765' }) referenceNumber: string;
  @ApiProperty({ enum: ['pending', 'applied', 'rejected', 'cancelled'] }) status: string;
  @ApiProperty({ example: '2026-10-30T08:34:00.000Z' }) submittedAt: string;
  @ApiProperty({ example: '2026-12-01', format: 'date', description: 'First month the new day applies' })
  effectiveFrom: string;
  @ApiProperty({ example: 5.44 }) feePerMortgage: number;
  @ApiProperty({ example: 16.32 }) totalFee: number;
  @ApiProperty({ example: '050-****122' }) notifyPhoneMasked: string;
  @ApiProperty({ type: [BillingDayRequestItemDto] }) items: BillingDayRequestItemDto[];
  @ApiProperty({
    description: 'True when this response replays an earlier submission with the same Idempotency-Key',
  })
  replayed: boolean;
}

export class PreviewItemDto {
  @ApiProperty({ format: 'uuid' }) mortgageId: string;
  @ApiProperty({ example: 1 }) previousBillingDay: number;
  @ApiProperty({ example: 10 }) newBillingDay: number;
  @ApiProperty({ example: 5.44 }) fee: number;
}

export class BillingDayRequestPreviewDto {
  @ApiProperty({ example: '2026-12-01', format: 'date' }) effectiveFrom: string;
  @ApiProperty({ example: 5.44 }) feePerMortgage: number;
  @ApiProperty({ example: 16.32 }) totalFee: number;
  @ApiProperty({ type: [PreviewItemDto] }) items: PreviewItemDto[];
}
