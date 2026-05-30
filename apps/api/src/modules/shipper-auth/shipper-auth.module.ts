import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { createShipperJwtOptions } from './config/shipper-jwt.config';
import { ShipperAuthController } from './shipper-auth.controller';
import { ShipperAuthService } from './shipper-auth.service';
import { ShipperJwtStrategy } from './shipper-jwt.strategy';
import { ShipperJwtGuard } from './shipper-jwt.guard';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createShipperJwtOptions(config),
    }),
  ],
  controllers: [ShipperAuthController],
  providers: [ShipperAuthService, ShipperJwtStrategy, ShipperJwtGuard],
  exports: [ShipperJwtGuard, JwtModule],
})
export class ShipperAuthModule {}
