import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleService } from './schedule.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

class RangeDto {
  @Matches(TIME_RE, { message: 'فرمت ساعت نامعتبر است' }) startTime!: string;
  @Matches(TIME_RE, { message: 'فرمت ساعت نامعتبر است' }) endTime!: string;
}

class DayScheduleDto {
  @IsIn(DAYS) dayOfWeek!: string;
  @IsBoolean() isActive!: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RangeDto) ranges!: RangeDto[];
}

class UpdateWorkingHoursDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => DayScheduleDto) days!: DayScheduleDto[];
}

class UpdateIntervalDto {
  @IsInt() @IsIn([15, 30, 45, 60, 90, 120]) slotIntervalMin!: number;
}

class CreateBlockDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاریخ نامعتبر است' }) date!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RangeDto) ranges!: RangeDto[];
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
}

@ApiTags('schedule')
@ApiBearerAuth()
@Roles('professional', 'admin')
@Controller('professionals/me/schedule')
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Get('settings')
  getSettings(@CurrentUser('id') userId: string) {
    return this.service.getSettings(userId);
  }

  @Put('working-hours')
  updateWorkingHours(@CurrentUser('id') userId: string, @Body() dto: UpdateWorkingHoursDto) {
    return this.service.updateWorkingHours(userId, dto.days);
  }

  @Patch('interval')
  updateInterval(@CurrentUser('id') userId: string, @Body() dto: UpdateIntervalDto) {
    return this.service.updateInterval(userId, dto.slotIntervalMin);
  }

  @Get('day')
  getDay(@CurrentUser('id') userId: string, @Query('date') date: string) {
    return this.service.getDay(userId, date);
  }

  @Get('month')
  getMonth(
    @CurrentUser('id') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getMonth(userId, from, to);
  }

  @Post('block')
  createBlock(@CurrentUser('id') userId: string, @Body() dto: CreateBlockDto) {
    return this.service.createBlock(userId, dto.date, dto.ranges, dto.reason);
  }

  @Delete('block/:id')
  removeBlock(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.removeBlock(userId, id);
  }
}
