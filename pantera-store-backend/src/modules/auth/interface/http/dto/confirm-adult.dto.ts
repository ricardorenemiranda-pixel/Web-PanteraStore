import { Matches } from 'class-validator';

export class ConfirmAdultDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate debe tener el formato AAAA-MM-DD.' })
  birthDate!: string;
}
