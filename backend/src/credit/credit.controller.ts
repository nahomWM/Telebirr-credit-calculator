import { Body, Controller, Get, Post } from '@nestjs/common';
import { CalculateCreditDto } from './dto/calculate-credit.dto';
import { CreditService } from './credit.service';
import { CreditCalculationResult, CreditConfig } from './credit.types';

@Controller()
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Get('credits')
  getCredits(): CreditConfig[] {
    return this.creditService.getCredits();
  }

  @Post('calculate')
  calculate(@Body() payload: CalculateCreditDto): CreditCalculationResult {
    return this.creditService.calculate(payload);
  }
}
