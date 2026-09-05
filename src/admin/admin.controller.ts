import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProfessionalStatus, PaymentStatus } from '@prisma/client';
import { IsEnum, IsNumber, Min, Max, IsOptional, IsString } from 'class-validator';

class StatusDto {
  @ApiProperty({ enum: ProfessionalStatus })
  @IsEnum(ProfessionalStatus)
  status: ProfessionalStatus;
}

class UpdateCommissionRateDto {
  @ApiProperty({ description: 'نرخ جدید کارمزد پلتفرم (بین ۰ تا ۱۰۰)', example: 10.0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;
}

class FinancialQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'paidAt', 'amount'] })
  @IsOptional()
  sortBy?: 'createdAt' | 'paidAt' | 'amount';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'آمار کلی پلتفرم' })
  stats() {
    return this.service.stats();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'داشبورد کامل Super Admin: KPI، روند ۳۰ روزه، موارد نیازمند توجه، فعالیت اخیر و رکوردهای اخیر (همه از داده واقعی)' })
  dashboard() {
    return this.service.dashboard();
  }

  @Get('finance/summary')
  @ApiOperation({ summary: 'خلاصه شاخص‌های مالی و درآمدی (تراکنش‌های واقعی، ناخالص، کارمزد پلتفرم، سهم زیباگر)' })
  financeSummary(@Query('period') period?: 'today' | 'this_month' | 'all_time') {
    return this.service.getFinancialSummary(period || 'all_time');
  }

  @Get('finance/transactions')
  @ApiOperation({ summary: 'فهرست تراکنش‌های مالی با صفحه‌بندی، فیلتر و جستجوی پیشرفته' })
  financeTransactions(@Query() query: FinancialQueryDto) {
    return this.service.listFinancialTransactions({
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      status: query.status,
      provider: query.provider,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  @Get('finance/transactions/:id')
  @ApiOperation({ summary: 'جزئیات یک تراکنش مالی شامل Snapshot کارمزد و رزرو مرتبط' })
  financeTransactionDetail(@Param('id') id: string) {
    return this.service.getFinancialTransactionDetail(id);
  }

  @Get('finance/settings/commission')
  @ApiOperation({ summary: 'دریافت نرخ فعلی کارمزد پلتفرم' })
  getCommissionRate() {
    return this.service.getCommissionSetting();
  }

  @Post('finance/settings/commission')
  @ApiOperation({ summary: 'تغییر نرخ کارمزد پلتفرم با ثبت در Audit Log (فقط بر پرداخت‌های آینده اثر می‌گذارد)' })
  updateCommissionRate(
    @Body() dto: UpdateCommissionRateDto,
    @CurrentUser('id') adminUserId?: string,
  ) {
    return this.service.updateCommissionSetting(dto.rate, adminUserId);
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
