import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { ProfessionalStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class StatusDto {
  @ApiProperty({ enum: ProfessionalStatus })
  @IsEnum(ProfessionalStatus)
  status: ProfessionalStatus;
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'آمار کلی پلتفرم' })
  stats() {
    return this.service.stats();
  }

  @Get('users')
  listUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('professionals')
  listPros(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: ProfessionalStatus,
  ) {
    return this.service.listProfessionals(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Patch('professionals/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.service.setProfessionalStatus(id, dto.status);
  }

  @Get('bookings')
  listBookings(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listBookings(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('audit-logs')
  auditLogs(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listAuditLogs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
