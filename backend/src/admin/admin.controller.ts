import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ProfessionalStatus,
  PaymentStatus,
  UserStatus,
  BookingStatus,
  MediaKind,
  MediaStatus,
  NotificationType,
} from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
} from 'class-validator';

class StatusDto {
  @ApiProperty({ enum: ProfessionalStatus })
  @IsEnum(ProfessionalStatus)
  status: ProfessionalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class UserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class UserRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  roles: string[];
}

class BookingStatusDto {
  @ApiProperty({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class ReviewVisibilityDto {
  @ApiProperty()
  @IsBoolean()
  isPublished: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class MediaStatusDto {
  @ApiProperty({ enum: MediaStatus })
  @IsEnum(MediaStatus)
  status: MediaStatus;
}

class FeatureDto {
  @ApiProperty()
  @IsBoolean()
  isFeatured: boolean;
}

class BroadcastNotificationDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiProperty({ enum: ['all', 'professionals', 'customers'] })
  @IsString()
  target: 'all' | 'professionals' | 'customers';
}

class UpdateCommissionRateDto {
  @ApiProperty({ description: 'نرخ جدید کارمزد پلتفرم (بین ۰ تا ۱۰۰)', example: 10.0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;
}

class UpdateFailedThresholdDto {
  @ApiProperty({ description: 'آستانه تعداد تراکنش‌های ناموفق در یک ساعت اخیر جهت فعال شدن هشدار', example: 3 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  threshold: number;
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
  @ApiOperation({ summary: 'داشبورد کامل Super Admin: KPI، روند ۳۰ روزه، موارد نیازمند توجه، فعالیت اخیر و رکوردهای اخیر' })
  dashboard() {
    return this.service.dashboard();
  }

  // --- Financial Management ---
  @Get('finance/summary')
  @ApiOperation({ summary: 'خلاصه شاخص‌های مالی و درآمدی' })
  financeSummary(@Query('period') period?: 'today' | 'this_month' | 'all_time') {
    return this.service.getFinancialSummary(period || 'all_time');
  }

  @Get('finance/transactions')
  @ApiOperation({ summary: 'فهرست تراکنش‌های مالی با صفحه‌بندی و فیلتر' })
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
  @ApiOperation({ summary: 'تغییر نرخ کارمزد پلتفرم با ثبت در Audit Log' })
  updateCommissionRate(
    @Body() dto: UpdateCommissionRateDto,
    @CurrentUser('id') adminUserId?: string,
  ) {
    return this.service.updateCommissionSetting(dto.rate, adminUserId);
  }

  @Get('finance/failed-alert')
  @ApiOperation({ summary: 'بررسی وضعیت هشدار تراکنش‌های ناموفق در یک ساعت اخیر و آستانه تعریف شده' })
  getFailedTransactionsAlert() {
    return this.service.getFailedTransactionsAlert();
  }

  @Post('finance/failed-alert/threshold')
  @ApiOperation({ summary: 'تنظیم حد آستانه هشدار تراکنش‌های ناموفق یک ساعت اخیر با ثبت در Audit Log' })
  updateFailedTransactionsThreshold(
    @Body() dto: UpdateFailedThresholdDto,
    @CurrentUser('id') adminUserId?: string,
  ) {
    return this.service.updateFailedTransactionsThreshold(dto.threshold, adminUserId);
  }

  // --- User Management ---
  @Get('users')
  @ApiOperation({ summary: 'فهرست کاربران همراه با جستجو و فیلتر وضعیت و نقش' })
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: UserStatus,
    @Query('role') role?: string,
  ) {
    return this.service.listUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      role,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'جزئیات کامل کاربر به همراه نقش‌ها، رزروها، پرداخت‌ها و تاریخچه اقدامات' })
  getUserDetail(@Param('id') id: string) {
    return this.service.getUserDetail(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'تغییر وضعیت کاربر با ثبت در Audit Log' })
  setUserStatus(
    @Param('id') id: string,
    @Body() dto: UserStatusDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.setUserStatus(id, dto.status, actorId, dto.reason);
  }

  @Patch('users/:id/roles')
  @ApiOperation({ summary: 'تخصیص نقش‌های کاربر با ثبت در Audit Log' })
  setUserRoles(
    @Param('id') id: string,
    @Body() dto: UserRolesDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.setUserRoles(id, dto.roles, actorId);
  }

  // --- Professional Management ---
  @Get('professionals')
  @ApiOperation({ summary: 'فهرست متخصصان و سالن‌ها با فیلتر وضعیت و نشان ویژه' })
  listPros(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: ProfessionalStatus,
    @Query('isFeatured') isFeatured?: string,
  ) {
    return this.service.listProfessionals({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
    });
  }

  @Get('professionals/:id')
  @ApiOperation({ summary: 'جزئیات کامل زیباگر شامل خدمات، ساعات کاری، شعبه‌ها، مدارک و آمار' })
  getProDetail(@Param('id') id: string) {
    return this.service.getProfessionalDetail(id);
  }

  @Patch('professionals/:id/status')
  @ApiOperation({ summary: 'تغییر وضعیت تایید یا تعلیق زیباگر با ثبت در Audit Log' })
  setStatus(
    @Param('id') id: string,
    @Body() dto: StatusDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.setProfessionalStatus(id, dto.status, actorId, dto.reason);
  }

  @Patch('professionals/:id/feature')
  @ApiOperation({ summary: 'تعیین وضعیت ویژه (Featured) زیباگر' })
  setFeatured(
    @Param('id') id: string,
    @Body() dto: FeatureDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.setProfessionalFeatured(id, dto.isFeatured, actorId);
  }

  // --- Booking Management ---
  @Get('bookings')
  @ApiOperation({ summary: 'فهرست رزروها با فیلتر وضعیت، تاریخ و جستجو' })
  listBookings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: BookingStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.listBookings({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      startDate,
      endDate,
    });
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'جزئیات کامل رزرو شامل مشتری، زیباگر، خدمات، پرداخت و نظرات' })
  getBookingDetail(@Param('id') id: string) {
    return this.service.getBookingDetail(id);
  }

  @Patch('bookings/:id/status')
  @ApiOperation({ summary: 'تغییر وضعیت نوبت رزرو با ثبت در Audit Log' })
  updateBookingStatus(
    @Param('id') id: string,
    @Body() dto: BookingStatusDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updateBookingStatus(id, dto.status, actorId, dto.reason);
  }

  // --- Review Moderation ---
  @Get('reviews')
  @ApiOperation({ summary: 'فهرست نظرات و امتیازات کاربران' })
  listReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('rating') rating?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    return this.service.listReviews({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      rating: rating ? parseInt(rating, 10) : undefined,
      isPublished: isPublished !== undefined ? isPublished === 'true' : undefined,
    });
  }

  @Patch('reviews/:id/visibility')
  @ApiOperation({ summary: 'تغییر وضعیت انتشار نظر با ثبت در لاگ' })
  setReviewVisibility(
    @Param('id') id: string,
    @Body() dto: ReviewVisibilityDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.setReviewVisibility(id, dto.isPublished, actorId, dto.reason);
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'حذف نظر توسط مدیر' })
  deleteReview(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteReview(id, actorId);
  }

  // --- Media Moderation ---
  @Get('media')
  @ApiOperation({ summary: 'فهرست فایل‌های چندرسانه‌ای بارگذاری‌شده' })
  listMedia(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('kind') kind?: MediaKind,
    @Query('status') status?: MediaStatus,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.service.listMedia({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 24,
      search,
      kind,
      status,
      professionalId,
    });
  }

  @Patch('media/:id/status')
  @ApiOperation({ summary: 'تغییر وضعیت فایل رسانه' })
  setMediaStatus(
    @Param('id') id: string,
    @Body() dto: MediaStatusDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.setMediaStatus(id, dto.status, actorId);
  }

  @Delete('media/:id')
  @ApiOperation({ summary: 'حذف فایل رسانه' })
  deleteMedia(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteMedia(id, actorId);
  }

  // --- Audit Logs ---
  @Get('audit-logs')
  @ApiOperation({ summary: 'گزارش رویدادها و لاگ‌های امنیتی مدیران با قابلیت فیلتر پیشرفته' })
  auditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.listAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      action,
      actorId,
      entityType,
      entityId,
      startDate,
      endDate,
    });
  }

  // --- Notifications ---
  @Get('notifications')
  @ApiOperation({ summary: 'فهرست اعلان‌های ارسال‌شده' })
  listNotifications(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: NotificationType,
    @Query('search') search?: string,
  ) {
    return this.service.listNotifications({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 30,
      type,
      search,
    });
  }

  @Post('notifications/broadcast')
  @ApiOperation({ summary: 'ارسال اعلان عمومی/گروهی به کاربران با ثبت در Audit Log' })
  broadcastNotification(
    @Body() dto: BroadcastNotificationDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.broadcastNotification(dto, actorId);
  }

  // --- Settings ---
  @Get('settings')
  @ApiOperation({ summary: 'دریافت تنظیمات پلتفرم' })
  getSettings() {
    return this.service.getPlatformSettings();
  }

  @Put('settings/:group')
  @ApiOperation({ summary: 'بروزرسانی گروه تنظیمات' })
  updateSettings(
    @Param('group') group: string,
    @Body() values: Record<string, any>,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updatePlatformSettingsGroup(group, values, actorId);
  }

  // --- Content / CMS ---
  @Get('content')
  @ApiOperation({ summary: 'دریافت محتواهای عمومی و صفحات استاتیک' })
  getContent() {
    return this.service.getCMSContent();
  }

  @Put('content')
  @ApiOperation({ summary: 'بروزرسانی محتواهای عمومی سامانه' })
  updateContent(
    @Body() content: Record<string, any>,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updateCMSContent(content, actorId);
  }

  // --- Site Builder ---
  @Get('site-builder')
  @ApiOperation({ summary: 'دریافت ساختار و چینش بخش‌های صفحه اصلی سایت' })
  getSiteBuilder() {
    return this.service.getSiteBuilder();
  }

  @Put('site-builder')
  @ApiOperation({ summary: 'ذخیره ساختار و ترتیب سکشن‌های صفحه اصلی' })
  updateSiteBuilder(
    @Body() sections: any[],
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updateSiteBuilder(sections, actorId);
  }

  // --- Roles & Permissions ---
  @Get('roles')
  @ApiOperation({ summary: 'فهرست نقش‌ها به همراه مجوزهای تخصیص‌داده‌شده' })
  listRoles() {
    return this.service.listRoles();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'فهرست تمام مجوزهای تعریف‌شده در سیستم' })
  listPermissions() {
    return this.service.listPermissions();
  }
}
