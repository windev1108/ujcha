import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePosReleaseDto } from './dto/update-pos-release.dto';

const ID = 'singleton';

@Injectable()
export class PosReleaseService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.prisma.posRelease.upsert({
      where: { id: ID },
      update: {},
      create: { id: ID },
    });
  }

  async update(dto: UpdatePosReleaseDto) {
    return this.prisma.posRelease.upsert({
      where: { id: ID },
      update: {
        version: dto.version,
        downloadUrl: dto.downloadUrl,
        releaseNotes: dto.releaseNotes ?? '',
      },
      create: {
        id: ID,
        version: dto.version,
        downloadUrl: dto.downloadUrl,
        releaseNotes: dto.releaseNotes ?? '',
      },
    });
  }
}
