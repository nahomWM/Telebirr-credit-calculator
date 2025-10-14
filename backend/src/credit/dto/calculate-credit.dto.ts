import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, Min } from 'class-validator';

const CREDIT_TYPES = [
  'Mela Daily',
  'Mela Weekly',
  'Mela Monthly',
  '50 Days Mela',
  'Endekise',
] as const;

export class CalculateCreditDto {
  @IsIn(CREDIT_TYPES)
  creditType!: (typeof CREDIT_TYPES)[number];

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  loanAmount!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
