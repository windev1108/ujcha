import { IsOptional, IsString } from 'class-validator';

export class SubscribePushDto {
    @IsString() endpoint: string;
    @IsString() p256dh: string;
    @IsString() auth: string;
    @IsString() deviceId: string;
    @IsOptional() @IsString() participantId?: string;
}

export class UnsubscribePushDto {
    @IsString() endpoint: string;
}