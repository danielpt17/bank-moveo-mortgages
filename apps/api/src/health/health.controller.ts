import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheService } from '../cache/cache.service';
import { DatabaseService } from '../database/database.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness/readiness: database must be up, Redis is reported but optional' })
  @ApiOkResponse({ schema: { example: { status: 'ok', database: 'up', redis: 'up' } } })
  async check(): Promise<{ status: string; database: string; redis: string }> {
    let database = 'up';
    try {
      await this.db.query('SELECT 1');
    } catch {
      database = 'down';
    }
    const redis = (await this.cache.ping()) ? 'up' : 'down';
    if (database === 'down') {
      throw new ServiceUnavailableException({ status: 'degraded', database, redis });
    }
    return { status: 'ok', database, redis };
  }
}
