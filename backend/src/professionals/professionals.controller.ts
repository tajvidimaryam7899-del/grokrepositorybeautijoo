import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ProfessionalsService } from './professionals.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateProDto {
  @IsString() @MinLength(3) slug!: string;
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() bio?: string;
}

class UpdateProDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() coverImageUrl?: string;
}

@ApiTags('professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  @Public()
  @Get()
  search(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.search({
      q,
      city,
      category,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Public()
  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Roles('customer', 'professional', 'admin')
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateProDto) {
    return this.service.createForUser(userId, dto);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Patch('me')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProDto) {
    return this.service.updateOwn(userId, dto);
  }
}
