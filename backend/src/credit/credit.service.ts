import { BadRequestException, Injectable } from '@nestjs/common';
import { addDays, differenceInCalendarDays, format, isAfter, isValid, parseISO } from 'date-fns';
import creditsDataset from '../data/credits.json';
import {
  CreditCalculationInput,
  CreditCalculationResult,
  CreditConfig,
  CreditDataset,
  RangeCreditConfig,
  RepaymentScheduleLine,
  TieredCreditConfig,
} from './credit.types';

const TIERED_PAYMENT_PERIOD_MAP: Record<string, number> = {
  'Mela Monthly': 30,
  '50 Days Mela': 50,
  Endekise: 30,
};

type TierRange = {
  tier: TieredCreditConfig['amounts'][number];
  min: number;
  maxExclusive?: number;
};

const MAX_LOAN_AMOUNT = 6_000_000;

@Injectable()
export class CreditService {
  private readonly credits: CreditConfig[] = (creditsDataset as CreditDataset).credits;

  getCredits(): CreditConfig[] {
    return this.credits;
  }

  calculate(input: CreditCalculationInput): CreditCalculationResult {
    const creditConfig = this.credits.find((credit) => credit.type === input.creditType);

    if (!creditConfig) {
      throw new BadRequestException('Unsupported credit type.');
    }

    const loanAmount = Number(input.loanAmount);

    if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
      throw new BadRequestException('Loan amount must be a positive number.');
    }

    if (loanAmount > MAX_LOAN_AMOUNT) {
      throw new BadRequestException('Loan amount cannot exceed ETB 6,000,000.');
    }

    const parsedStart = parseISO(input.startDate);
    const parsedEnd = parseISO(input.endDate);

    if (!isValid(parsedStart) || !isValid(parsedEnd)) {
      throw new BadRequestException('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
    }

    if (isAfter(parsedStart, parsedEnd)) {
      throw new BadRequestException('Start date must be on or before the end date.');
    }

    const loanPeriodDays = differenceInCalendarDays(parsedEnd, parsedStart) + 1;

    if (loanPeriodDays <= 0) {
      throw new BadRequestException('Loan period must be at least one day.');
    }

    if (this.isRangeCredit(creditConfig)) {
      this.assertLoanWithinRange(loanAmount, creditConfig);
      return this.calculateForRangeCredit(loanAmount, parsedStart, parsedEnd, loanPeriodDays, creditConfig);
    }

    const tieredConfig = creditConfig;
    const matchedRange = this.findTierRangeForAmount(tieredConfig, loanAmount);

    if (!matchedRange) {
      throw new BadRequestException('Loan amount does not fall within available ranges for the selected credit type.');
    }

    return this.calculateForTieredCredit(loanAmount, parsedStart, parsedEnd, loanPeriodDays, tieredConfig, matchedRange.tier);
  }

  private calculateForRangeCredit(
    loanAmount: number,
    startDate: Date,
    endDate: Date,
    loanPeriodDays: number,
    credit: RangeCreditConfig,
  ): CreditCalculationResult {
    const facilitationFee = this.roundTwoDecimals((loanAmount * credit.facilitationFeePercent) / 100);
    const baseDailyFee = credit.dailyFeePercent > 0 ? (loanAmount * credit.dailyFeePercent) / 100 : 0;
    const dailyFeeCap = credit.dailyFeeMaxPercent ? (loanAmount * credit.dailyFeeMaxPercent) / 100 : null;

    let dailyFeeAccumulated = 0;
    const dailyFees: number[] = [];

    for (let dayIndex = 0; dayIndex < loanPeriodDays; dayIndex += 1) {
      if (baseDailyFee === 0) {
        dailyFees.push(0);
        continue;
      }

      const remainingCap = dailyFeeCap !== null ? Math.max(dailyFeeCap - dailyFeeAccumulated, 0) : Number.POSITIVE_INFINITY;
      const dailyFeeForDay = Math.min(baseDailyFee, remainingCap);
      dailyFees.push(this.roundTwoDecimals(dailyFeeForDay));
      dailyFeeAccumulated += dailyFeeForDay;
    }

    const totalDailyFee = this.roundTwoDecimals(dailyFees.reduce((sum, fee) => sum + fee, 0));
    const penaltyFee = this.computePenaltyFee(loanAmount, startDate, endDate, credit.paymentPeriodDays, credit.penaltyPercent);
    const schedule = this.buildSchedule(loanAmount, startDate, loanPeriodDays, credit.paymentPeriodDays, dailyFees, penaltyFee);

    return {
      creditType: credit.type,
      loanAmount,
      loanPeriodDays,
      facilitationFee,
      dailyFee: totalDailyFee,
      penaltyFee,
      totalRepayment: this.roundTwoDecimals(loanAmount + facilitationFee + totalDailyFee + penaltyFee),
      schedule,
    };
  }

  private calculateForTieredCredit(
    loanAmount: number,
    startDate: Date,
    endDate: Date,
    loanPeriodDays: number,
    credit: TieredCreditConfig,
    tier: TieredCreditConfig['amounts'][number],
  ): CreditCalculationResult {
    const facilitationFee = this.roundTwoDecimals((loanAmount * tier.facilitationFeePercent) / 100);
    const baseDailyFee = (loanAmount * tier.dailyFeePercent) / 100;
    const paymentPeriodDays = TIERED_PAYMENT_PERIOD_MAP[credit.type] ?? loanPeriodDays;

    const dailyFees = Array.from({ length: loanPeriodDays }, () => this.roundTwoDecimals(baseDailyFee));
    const totalDailyFee = this.roundTwoDecimals(baseDailyFee * loanPeriodDays);
    const penaltyFee = this.computePenaltyFee(loanAmount, startDate, endDate, paymentPeriodDays, tier.penaltyPercent);
    const schedule = this.buildSchedule(loanAmount, startDate, loanPeriodDays, paymentPeriodDays, dailyFees, penaltyFee);

    return {
      creditType: credit.type,
      loanAmount,
      loanPeriodDays,
      facilitationFee,
      dailyFee: totalDailyFee,
      penaltyFee,
      totalRepayment: this.roundTwoDecimals(loanAmount + facilitationFee + totalDailyFee + penaltyFee),
      schedule,
    };
  }

  private buildSchedule(
    loanAmount: number,
    startDate: Date,
    loanPeriodDays: number,
    allowedPeriodDays: number,
    dailyFees: number[],
    penaltyFeeTotal: number,
  ): RepaymentScheduleLine[] {
    let dailyFeeRunningTotal = 0;
    let penaltyFeeRunningTotal = 0;

    const overdueDays = Math.max(loanPeriodDays - allowedPeriodDays, 0);
    const penaltyPerDay = overdueDays > 0 ? penaltyFeeTotal / overdueDays : 0;

    return Array.from({ length: loanPeriodDays }, (_, index) => {
      const currentDate = addDays(startDate, index);
      const dailyFee = dailyFees[index] ?? 0;
      const isOverdueDay = index >= allowedPeriodDays;
      const penaltyFee = isOverdueDay ? penaltyPerDay : 0;

      dailyFeeRunningTotal += dailyFee;
      penaltyFeeRunningTotal += penaltyFee;

      return {
        date: format(currentDate, 'yyyy-MM-dd'),
        outstandingPrincipal: this.roundTwoDecimals(loanAmount),
        dailyFee: this.roundTwoDecimals(dailyFee),
        penaltyFee: this.roundTwoDecimals(penaltyFee),
        subtotal: this.roundTwoDecimals(loanAmount + dailyFeeRunningTotal + penaltyFeeRunningTotal),
      };
    });
  }

  private computePenaltyFee(
    loanAmount: number,
    startDate: Date,
    endDate: Date,
    allowedPeriodDays: number,
    penaltyPercent: number,
  ): number {
    const allowedEndDate = addDays(startDate, allowedPeriodDays - 1);

    if (!isAfter(endDate, allowedEndDate)) {
      return 0;
    }

    const overdueDays = differenceInCalendarDays(endDate, allowedEndDate);

    if (overdueDays <= 0) {
      return 0;
    }

    return this.roundTwoDecimals((loanAmount * penaltyPercent * overdueDays) / 100);
  }

  private assertLoanWithinRange(amount: number, credit: RangeCreditConfig): void {
    if (amount < credit.minLoan || amount > credit.maxLoan) {
      throw new BadRequestException('Loan amount is outside the allowed range for this credit type.');
    }
  }

  private buildTierRanges(credit: TieredCreditConfig): TierRange[] {
    const sorted = [...credit.amounts].sort((a, b) => a.amount - b.amount);
    return sorted.map((tier, index) => {
      const next = sorted[index + 1];
      return {
        tier,
        min: tier.amount,
        maxExclusive: next ? next.amount : undefined,
      };
    });
  }

  private findTierRangeForAmount(credit: TieredCreditConfig, amount: number): TierRange | undefined {
    return this.buildTierRanges(credit).find((range) => amount >= range.min && (range.maxExclusive === undefined || amount < range.maxExclusive));
  }

  private isRangeCredit(credit: CreditConfig): credit is RangeCreditConfig {
    return 'minLoan' in credit && 'maxLoan' in credit;
  }

  private roundTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
