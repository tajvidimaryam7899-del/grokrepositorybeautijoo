import { Controller, Post, Get, Delete, Param, Query, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MediaKind } from '@prisma/client';
import { MediaService } from './media.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('media')
@ApiBearerAuth()
@Roles('professional', 'admin')
@Controller('professionals/me/media')
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query('kind') kind?: MediaKind) {
    return this.service.listMine(userId, kind);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string' },
        professionalServiceId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    @Body('kind') kind: MediaKind,
    @Body('professionalServiceId') professionalServiceId?: string,
  ) {
    return this.service.upload(userId, file, kind, professionalServiceId);
  }

  @Post('publish')
  publish(@CurrentUser('id') userId: string, @Body() body: { ids: string[] }) {
    return this.service.publishAssets(userId, body.ids || []);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deleteMine(userId, id);
  }
}
