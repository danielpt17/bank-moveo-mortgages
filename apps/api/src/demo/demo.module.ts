import { Module } from '@nestjs/common';
import { LobbyModule } from '../lobby/lobby.module';
import { DemoController } from './demo.controller';

@Module({
  imports: [LobbyModule],
  controllers: [DemoController],
})
export class DemoModule {}
