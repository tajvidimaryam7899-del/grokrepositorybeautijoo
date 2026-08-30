import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
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

class UpsertPriceRuleDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(1) label!: string;
  @Type(() => Number) @IsInt() @Min(0) price!: number;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

class UpsertDurationRuleDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(1) label!: string;
  @Type(() => Number) @IsInt() @Min(5) durationMin!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) durationMaxMin?: number;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
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

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Get('professionals/me/services/:psId/price-rules')
  listPriceRules(@CurrentUser('id') userId: string, @Param('psId') psId: string) {
    return this.service.listPriceRules(userId, psId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Post('professionals/me/services/:psId/price-rules')
  upsertPriceRule(
    @CurrentUser('id') userId: string,
    @Param('psId') psId: string,
    @Body() dto: UpsertPriceRuleDto,
  ) {
    return this.service.upsertPriceRule(userId, psId, dto);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Delete('professionals/me/price-rules/:id')
  deactivatePriceRule(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deactivatePriceRule(userId, id);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Get('professionals/me/services/:psId/duration-rules')
  listDurationRules(@CurrentUser('id') userId: string, @Param('psId') psId: string) {
    return this.service.listDurationRules(userId, psId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Post('professionals/me/services/:psId/duration-rules')
  upsertDurationRule(
    @CurrentUser('id') userId: string,
    @Param('psId') psId: string,
    @Body() dto: UpsertDurationRuleDto,
  ) {
    return this.service.upsertDurationRule(userId, psId, dto);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Delete('professionals/me/duration-rules/:id')
  deactivateDurationRule(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deactivateDurationRule(userId, id);
  }
}
