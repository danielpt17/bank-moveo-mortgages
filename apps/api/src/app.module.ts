import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingDayRequestsModule } from './billing-day-requests/billing-day-requests.module';
import { CacheModule } from './cache/cache.module';
import { DemoCustomerMiddleware } from './common/demo-customer.middleware';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { LobbyModule } from './lobby/lobby.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    CacheModule,
    LobbyModule,
    BillingDayRequestsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DemoCustomerMiddleware).forRoutes('*');
  }
}
