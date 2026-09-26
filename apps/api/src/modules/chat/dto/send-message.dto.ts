import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export enum ChatMessageType {
    TEXT = 'text',
    STICKER = 'sticker',
    IMAGE = 'image',
}

export class SendMessageDto {
    @IsOptional()
    @IsEnum(ChatMessageType)
    type?: ChatMessageType;

    @IsString()
    @Length(1, 2000)
    content: string;

    /** Order flow: required, matches Order.paymentCode (guest capability). */
    @IsOptional()
    @IsString()
    paymentCode?: string;

    /** Group-order flow: required, matches GroupOrderParticipant.sessionToken (guest capability). */
    @IsOptional()
    @IsString()
    sessionToken?: string;
}