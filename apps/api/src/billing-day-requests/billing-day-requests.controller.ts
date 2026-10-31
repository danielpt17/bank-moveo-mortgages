import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { BillingDayRequestsService } from './billing-day-requests.service';
import { BillingDayRequestDto, BillingDayRequestPreviewDto } from './dto/billing-day-request.dto';
import { CreateBillingDayRequestDto, PreviewBillingDayRequestDto } from './dto/create-billing-day-request.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('billing-day-requests')
@Controller('billing-day-requests')
export class BillingDayRequestsController {
  constructor(private readonly service: BillingDayRequestsService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quote the effective month and fees for a candidate request' })
  @ApiOkResponse({ type: BillingDayRequestPreviewDto })
  @ApiForbiddenResponse({ description: 'A mortgage does not belong to the customer' })
  @ApiUnprocessableEntityResponse({ description: 'A chosen day is not allowed or equals the current day' })
  @ApiConflictResponse({ description: 'A mortgage already has an open request' })
  preview(
    @CurrentCustomer() customerId: string,
    @Body() dto: PreviewBillingDayRequestDto,
  ): Promise<BillingDayRequestPreviewDto> {
    return this.service.preview(customerId, dto.items);
  }

  @Post()
  @ApiOperation({
    summary: 'Submit a billing-day change request',
    description:
      'Idempotent: resubmitting with the same Idempotency-Key returns the original request with HTTP 200 ' +
      'and replayed=true instead of creating a second one.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID generated once per flow attempt' })
  @ApiCreatedResponse({ type: BillingDayRequestDto, description: 'Request created' })
  @ApiOkResponse({ type: BillingDayRequestDto, description: 'Replay of an earlier submission' })
  @ApiForbiddenResponse({ description: 'A mortgage does not belong to the customer' })
  @ApiUnprocessableEntityResponse({ description: 'A chosen day is not allowed or equals the current day' })
  @ApiConflictResponse({ description: 'A mortgage already has an open request' })
  async create(
    @CurrentCustomer() customerId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateBillingDayRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BillingDayRequestDto> {
    if (!idempotencyKey || !UUID_RE.test(idempotencyKey)) {
      throw new BadRequestException({
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header (UUID) is required',
      });
    }
    const { request, created } = await this.service.create(customerId, idempotencyKey, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return request;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a request by id (own requests only)' })
  @ApiOkResponse({ type: BillingDayRequestDto })
  @ApiNotFoundResponse({ description: 'Not found or not owned by the customer' })
  getById(
    @CurrentCustomer() customerId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<BillingDayRequestDto> {
    return this.service.getById(customerId, id);
  }
}
