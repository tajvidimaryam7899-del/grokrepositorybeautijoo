import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { LocationsService } from './locations.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class AddLocationDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(5) address!: string;
  @IsString() @MinLength(2) city!: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

class WorkingHourDto {
  @IsString() dayOfWeek!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() breaks?: { startTime: string; endTime: string }[];
}

class TimeOffDto {
  @IsString() startAt!: string;
  @IsString() endAt!: string;
  @IsOptional() @IsString() reason?: string;
}

@ApiTags('locations-hours')
@ApiBearerAuth()
@Roles('professional', 'admin')
@Controller('professionals/me')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get('locations')
  listLocations(@CurrentUser('id') userId: string) {
    return this.service.listMine(userId);
  }

  @Post('locations')
  addLocation(@CurrentUser('id') userId: string, @Body() dto: AddLocationDto) {
    return this.service.addLocation(userId, dto);
  }

  @Get('working-hours')
  listHours(@CurrentUser('id') userId: string) {
    return this.service.listWorkingHours(userId);
  }

  @Post('working-hours')
  setHours(@CurrentUser('id') userId: string, @Body() dto: WorkingHourDto) {
    return this.service.setWorkingHours(userId, dto);
  }

  @Post('time-off')
  timeOff(@CurrentUser('id') userId: string, @Body() dto: TimeOffDto) {
    return this.service.addTimeOff(userId, dto);
  }
}
