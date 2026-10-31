import { Module } from '@nestjs/common';
import { LobbyModule } from '../lobby/lobby.module';
import { BillingDayRequestsController } from './billing-day-requests.controller';
import { BillingDayRequestsRepository } from './billing-day-requests.repository';
import { BillingDayRequestsService } from './billing-day-requests.service';

@Module({
  imports: [LobbyModule],
  controllers: [BillingDayRequestsController],
  providers: [BillingDayRequestsService, BillingDayRequestsRepository],
})
export class BillingDayRequestsModule {}
