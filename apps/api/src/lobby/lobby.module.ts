import { Module } from '@nestjs/common';
import { LobbyController } from './lobby.controller';
import { LobbyRepository } from './lobby.repository';
import { LobbyService } from './lobby.service';

@Module({
  controllers: [LobbyController],
  providers: [LobbyService, LobbyRepository],
  exports: [LobbyService],
})
export class LobbyModule {}
