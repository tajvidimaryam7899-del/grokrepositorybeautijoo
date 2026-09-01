import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength, IsArray, IsUUID } from 'class-validator';
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
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) bio?: string;
  @IsOptional() @IsString() @MaxLength(512) coverImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsString() @MaxLength(512) avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(5000) profileBio?: string;
  /** Root service category IDs selected by the professional */
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) selectedCategoryIds?: string[];
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
      q, city, category,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.service.getOwn(userId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Get('me/completion')
  async getCompletion(@CurrentUser('id') userId: string) {
    const own = await this.service.getOwn(userId);
    return own.completion;
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Get('me/preview')
  getPreview(@CurrentUser('id') userId: string) {
    return this.service.getOwnPreview(userId);
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

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Post('me/publish')
  publish(@CurrentUser('id') userId: string) {
    return this.service.publish(userId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin')
  @Post('me/unpublish')
  unpublish(@CurrentUser('id') userId: string) {
    return this.service.unpublish(userId);
  }
}
