import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ALLOWED_BILLING_DAYS } from '../domain/billing-day.rules';

export class BillingDayRequestItemInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mortgageId: string;

  @ApiProperty({ enum: ALLOWED_BILLING_DAYS, example: 10 })
  @IsInt()
  @IsIn([...ALLOWED_BILLING_DAYS])
  newBillingDay: number;
}

export class PreviewBillingDayRequestDto {
  @ApiProperty({ type: [BillingDayRequestItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: BillingDayRequestItemInputDto) => item.mortgageId, {
    message: 'each mortgage may appear only once',
  })
  @ValidateNested({ each: true })
  @Type(() => BillingDayRequestItemInputDto)
  items: BillingDayRequestItemInputDto[];
}

/** Same body as the preview. Pressing אישור under the terms is the acceptance, so there is no extra flag. */
export class CreateBillingDayRequestDto extends PreviewBillingDayRequestDto {}
