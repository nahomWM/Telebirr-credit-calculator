import { Controller, Get, Post, Body } from '@nestjs/common';
import * as creditsService_1 from './credits.service';

@Controller('api')
export class CreditsController {
    constructor(private readonly creditsService: creditsService_1.CreditsService) { }

    @Get('credits')
    getCredits() {
        return this.creditsService.getCredits();
    }

    @Post('calculate')
    calculate(@Body() dto: creditsService_1.CalculateDto) {
        return this.creditsService.calculate(dto);
    }
}
