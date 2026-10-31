import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '401-123456' }) accountNumber: string;
  @ApiProperty({ example: 'אביגיל' }) firstName: string;
  @ApiProperty({ example: 'רוזנבלום' }) lastName: string;
  @ApiProperty({ example: '050-****122', description: 'Masked phone for display' }) phoneMasked: string;
}

export class ChargeDto {
  @ApiProperty({ example: '2025-01-12', format: 'date' }) date: string;
  @ApiProperty({ example: 1521.24 }) amount: number;
}

export class PendingRequestSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '6565765' }) referenceNumber: string;
  @ApiProperty({ example: 10, enum: [1, 10, 15] }) newBillingDay: number;
  @ApiProperty({ example: '2026-12-01', format: 'date' }) effectiveFrom: string;
}

export class MortgageDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '2392345632' }) mortgageNumber: string;
  @ApiProperty({ example: 'רכישת דירה יד שניה' }) productName: string;
  @ApiProperty({ type: [String], example: ['אביגיל רוזנבלום', 'יוסי רוזנבלום'] }) borrowers: string[];
  @ApiProperty({ example: 1100500 }) remainingBalance: number;
  @ApiProperty({ example: 1521.24 }) monthlyPayment: number;
  @ApiProperty({ example: 5.75 }) interestRate: number;
  @ApiProperty({ example: 173.98 }) monthlyInterest: number;
  @ApiProperty({ example: 10, description: 'Current billing day of month' }) billingDay: number;
  @ApiProperty({ example: '2020-01-15', format: 'date' }) startDate: string;
  @ApiProperty({ example: '2045-01-15', format: 'date' }) endDate: string;
  @ApiPropertyOptional({ type: ChargeDto, nullable: true }) lastCharge: ChargeDto | null;
  @ApiPropertyOptional({ type: ChargeDto, nullable: true }) nextCharge: ChargeDto | null;
  @ApiProperty() hasPaymentDelays: boolean;
  @ApiPropertyOptional({ type: PendingRequestSummaryDto, nullable: true })
  pendingBillingDayRequest: PendingRequestSummaryDto | null;
}

export class PortfolioSummaryDto {
  @ApiProperty({ example: 1348000 }) totalRemainingWithFees: number;
  @ApiProperty({ example: 1346544 }) totalRemaining: number;
  @ApiProperty({ example: 7500 }) totalMonthlyPayment: number;
  @ApiPropertyOptional({ example: '2045-01-15', format: 'date', nullable: true }) lastRepaymentDate: string | null;
  @ApiProperty() mortgageCount: number;
}

export class PropertyDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'רבי יוחנן הלוי 23' }) street: string;
  @ApiProperty({ example: 'ירושלים' }) city: string;
  @ApiProperty({ type: PortfolioSummaryDto }) summary: PortfolioSummaryDto;
  @ApiProperty({ type: [MortgageDto] }) mortgages: MortgageDto[];
}

export class LobbyDto {
  @ApiProperty({ type: CustomerDto }) customer: CustomerDto;
  @ApiProperty({ type: PortfolioSummaryDto }) summary: PortfolioSummaryDto;
  @ApiProperty({ type: [PropertyDto] }) properties: PropertyDto[];
  @ApiProperty({ example: '2026-10-30T08:34:00.000Z', description: 'When this snapshot was built' })
  generatedAt: string;
  @ApiProperty({ description: 'True when served from Redis' }) fromCache: boolean;
}
