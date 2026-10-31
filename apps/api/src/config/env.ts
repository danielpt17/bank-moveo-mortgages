import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min, validateSync } from 'class-validator';

export class Env {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT: number = 3000;

  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_URL: string;

  @Type(() => Number)
  @IsInt()
  @Min(1) // Redis rejects EX 0; a 0 TTL would silently disable the cache
  LOBBY_CACHE_TTL_SECONDS: number = 300;

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:5173';

  @IsUUID()
  DEMO_CUSTOMER_ID: string = '11111111-1111-4111-8111-111111111111';

  @IsString()
  BUSINESS_TIMEZONE: string = 'Asia/Jerusalem';
}

/** Validates process.env at startup so a misconfigured container fails fast. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.map((e) => e.property).join(', ')}`);
  }
  return env;
}
