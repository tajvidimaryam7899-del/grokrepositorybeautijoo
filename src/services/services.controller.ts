import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ServicesService } from './services.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class UpsertProServiceDto {
  @IsUUID() serviceId!: string;
  @Type(() => Number) @IsInt() @Min(5) durationMin!: number;
  @Type(() => Number) @IsInt() @Min(0) price!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferMin?: number;
  @IsOptional() @IsString() description?: string;
}

@ApiTags('services')
@Controller()
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Public()
  @Get('categories')
  categories() {
    return this.service.listCategories();
  }

  @Public()
  @Get('services')
  services(@Query('category') category?: string) {
    return this.service.listServices(category);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Get('professionals/me/services')
  myServices(@CurrentUser('id') userId: string) {
    return this.service.listMyServices(userId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Post('professionals/me/services')
  upsert(@CurrentUser('id') userId: string, @Body() dto: UpsertProServiceDto) {
    return this.service.upsertProfessionalService(userId, dto);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Delete('professionals/me/services/:id')
  deactivate(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deactivateMyService(userId, id);
  }
}
