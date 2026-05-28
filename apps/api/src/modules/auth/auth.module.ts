import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { FraudModule } from '../fraud/fraud.module';
import { GoogleAuthModule } from '../google-auth/google-auth.module';
import { SmsModule } from '../sms/sms.module';
import { VoucherModule } from '../voucher/voucher.module';
import { OtpModule } from '../otp/otp.module';
import { SessionModule } from '../session/session.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { createJwtAccessOptions } from './config/jwt.config';
import { JwtTokensService } from './jwt-tokens.service';
import { JwtAuthGuard } from './jwt.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createJwtAccessOptions(config),
    }),
    FraudModule,
    GoogleAuthModule,
    SessionModule,
    OtpModule,
    UserModule,
    SmsModule,
    VoucherModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtTokensService, JwtStrategy, JwtAuthGuard],
  exports: [
    AuthService,
    JwtTokensService,
    JwtModule,
    PassportModule,
    JwtAuthGuard,
    SessionModule,
    FraudModule,
  ],
})
export class AuthModule {}
