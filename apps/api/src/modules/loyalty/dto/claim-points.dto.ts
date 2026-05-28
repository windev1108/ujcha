import { IsUUID } from 'class-validator';

export class ClaimPointsDto {
  @IsUUID()
  userId: string;
}
