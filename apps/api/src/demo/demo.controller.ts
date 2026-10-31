import { Controller, ForbiddenException, Headers, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { Env } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { LobbyService } from '../lobby/lobby.service';

/**
 * Demo helper: every submitted request blocks its mortgage (one open request per mortgage), so
 * reviewers need a way to start over. Deletes the demo customer's requests and drops the lobby
 * cache. Only available when DEMO_RESET_TOKEN is configured, and only with that token.
 */
@ApiTags('demo')
@Controller('demo')
export class DemoController {
  private readonly token: string | undefined;

  constructor(
    private readonly db: DatabaseService,
    private readonly lobby: LobbyService,
    config: ConfigService<Env, true>,
  ) {
    this.token = config.get('DEMO_RESET_TOKEN', { infer: true });
  }

  @Post('reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete the demo customer’s billing-day requests and invalidate the lobby cache' })
  @ApiHeader({ name: 'X-Demo-Reset-Token', required: true, description: 'Must equal DEMO_RESET_TOKEN' })
  @ApiOkResponse({ schema: { example: { deletedRequests: 2 } } })
  @ApiForbiddenResponse({ description: 'Wrong token' })
  @ApiNotFoundResponse({ description: 'Reset is not enabled on this deployment' })
  async reset(
    @CurrentCustomer() customerId: string,
    @Headers('x-demo-reset-token') token: string | undefined,
  ): Promise<{ deletedRequests: number }> {
    if (!this.token) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    if (token !== this.token) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Invalid reset token' });

    // items cascade from requests
    const rows = await this.db.query<{ id: string }>(
      'DELETE FROM billing_day_requests WHERE customer_id = $1 RETURNING id',
      [customerId],
    );
    await this.lobby.invalidate(customerId);
    return { deletedRequests: rows.length };
  }
}
