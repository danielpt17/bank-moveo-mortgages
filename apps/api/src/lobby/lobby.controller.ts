import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { LobbyDto } from './dto/lobby.dto';
import { LobbyService } from './lobby.service';

@ApiTags('lobby')
@Controller('lobby')
export class LobbyController {
  constructor(private readonly lobby: LobbyService) {}

  @Get()
  @ApiOperation({
    summary: 'Mortgage lobby for the current customer',
    description: 'Portfolio summary and mortgages grouped by property. Served from Redis when cached.',
  })
  @ApiOkResponse({ type: LobbyDto })
  getLobby(@CurrentCustomer() customerId: string): Promise<LobbyDto> {
    return this.lobby.getLobby(customerId);
  }
}
