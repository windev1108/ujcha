import { IsArray, IsBoolean, IsString } from 'class-validator';

export class BulkPinFeedbackDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsBoolean()
  pin: boolean;
}
