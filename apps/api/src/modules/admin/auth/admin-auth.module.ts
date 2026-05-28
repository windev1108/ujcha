import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GoogleAuthModule } from '../../google-auth/google-auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { createAdminJwtOptions } from './config/admin-jwt.config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    GoogleAuthModule,
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createAdminJwtOptions(config),
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtStrategy, AdminJwtGuard, RolesGuard],
  exports: [AdminJwtGuard, RolesGuard, JwtModule],
})
export class AdminAuthModule {}
