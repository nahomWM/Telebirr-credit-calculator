export interface RangeCreditConfig {
  type: string;
  minLoan: number;
  maxLoan: number;
  paymentPeriodDays: number;
  facilitationFeePercent: number;
  dailyFeePercent: number;
  dailyFeeMaxPercent?: number;
  penaltyPercent: number;
}

export interface TieredCreditAmount {
  amount: number;
  facilitationFeePercent: number;
  dailyFeePercent: number;
  penaltyPercent: number;
}

export interface TieredCreditConfig {
  type: string;
  amounts: TieredCreditAmount[];
}

export type CreditConfig = RangeCreditConfig | TieredCreditConfig;

export interface CreditCalculationPayload {
  creditType: string;
  loanAmount: number;
  startDate: string;
  endDate: string;
}

export interface RepaymentScheduleLine {
  date: string;
  outstandingPrincipal: number;
  dailyFee: number;
  penaltyFee: number;
  subtotal: number;
}

export interface CreditCalculationResult {
  creditType: string;
  loanAmount: number;
  loanPeriodDays: number;
  facilitationFee: number;
  dailyFee: number;
  penaltyFee: number;
  totalRepayment: number;
  schedule: RepaymentScheduleLine[];
}
