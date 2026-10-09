import { IsInt, Min } from 'class-validator';

export class AcceptTermsDto {
  @IsInt()
  @Min(1)
  version!: number;
}
