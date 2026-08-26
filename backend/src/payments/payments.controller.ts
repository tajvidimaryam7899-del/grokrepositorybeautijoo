import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initiate')
  async initiate(
    @CurrentUser('id') userId: string,
    @Body() body: { bookingId: string },
  ) {
    return this.payments.initiate(userId, body.bookingId);
  }

  @Post('verify')
  async verify(
    @CurrentUser('id') userId: string,
    @Body() body: { paymentId: string; providerRef?: string },
  ) {
    return this.payments.verify(userId, body.paymentId, body.providerRef);
  }

  @Get(':id')
  async getOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.payments.findOne(userId, id);
  }

  @Post(':id/refund')
  @Roles('admin')
  async refund(@Param('id') id: string) {
    return this.payments.refund(id);
  }
}
