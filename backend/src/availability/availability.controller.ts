import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('availability')
@Controller('professionals/:id/availability')
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Public()
  @Get()
  slots(
    @Param('id') id: string,
    @Query('date') date: string,
    @Query('durationMin') durationMin?: string,
  ) {
    return this.service.getSlots(id, date, durationMin ? parseInt(durationMin, 10) : 30);
  }
}
