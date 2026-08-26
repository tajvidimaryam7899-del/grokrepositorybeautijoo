import { Body, Controller, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { PaymentsService } from './payments.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class InitiateDto {
  @IsUUID() bookingId!: string;
  @IsString() callbackUrl!: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @ApiBearerAuth()
  @Roles('customer', 'admin')
  @Post('initiate')
  initiate(@CurrentUser('id') userId: string, @Body() dto: InitiateDto) {
    return this.service.initiate(userId, dto.bookingId, dto.callbackUrl);
  }

  @Public()
  @Post('callback')
  callback(@Query('ref') ref: string) {
    return this.service.callback(ref);
  }
}
