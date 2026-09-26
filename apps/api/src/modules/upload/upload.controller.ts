import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { Readable } from 'stream';
import * as express from 'express';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) { }


  @Post('tmp-file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    }),
  )
  async uploadImage(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException({
        message: 'Thiếu file ảnh.',
        code: 'IMAGE_MISSING',
      });
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException({
        message: 'File phải là ảnh.',
        code: 'IMAGE_INVALID_TYPE',
      });
    }
    const url = await this.uploadService.uploadTempImage(
      file.buffer,
      file.originalname,
    );
    return { url };
  }
}
