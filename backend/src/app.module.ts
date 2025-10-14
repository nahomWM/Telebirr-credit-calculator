import { Module } from '@nestjs/common';
import { CreditModule } from './credit/credit.module';

@Module({
  imports: [CreditModule],
})
export class AppModule {}
