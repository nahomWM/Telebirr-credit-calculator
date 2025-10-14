import { useCallback, useEffect, useMemo, useState } from 'react';
import { calculateLoan, fetchCredits } from './api';
import {
  CreditCalculationPayload,
  CreditCalculationResult,
  CreditConfig,
  RangeCreditConfig,
  RepaymentScheduleLine,
  TieredCreditConfig,
} from './types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'ETB',
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number): string => currencyFormatter.format(value);
const formatNumber = (value: number): string => numberFormatter.format(value);

const isRangeCredit = (credit: CreditConfig): credit is RangeCreditConfig =>
  'minLoan' in credit && 'maxLoan' in credit;

const isTieredCredit = (credit: CreditConfig): credit is TieredCreditConfig => 'amounts' in credit;

const getDefaultDates = () => {
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
};

type TierRange = {
  tier: TieredCreditConfig['amounts'][number];
  min: number;
  maxExclusive?: number;
};

const buildTierRanges = (credit: TieredCreditConfig): TierRange[] => {
  const sorted = [...credit.amounts].sort((a, b) => a.amount - b.amount);
  return sorted.map((tier, index) => {
    const next = sorted[index + 1];
    return {
      tier,
      min: tier.amount,
      maxExclusive: next ? next.amount : undefined,
    };
  });
};

const describeTierRange = (range: TierRange): string => {
  if (range.maxExclusive === undefined) {
    return `${formatCurrency(range.min)} or more`;
  }

  return `${formatCurrency(range.min)} ≤ amount < ${formatCurrency(range.maxExclusive)}`;
};

const findTierRangeForAmount = (credit: TieredCreditConfig, amount: number): TierRange | undefined => {
  if (amount > MAX_LOAN_AMOUNT) {
    return undefined;
  }

  return buildTierRanges(credit).find((range) => amount >= range.min && (range.maxExclusive === undefined || amount < range.maxExclusive));
};

const mapTierDescriptor = (credit: TieredCreditConfig): string => credit.type;

const mapRangeDescriptor = (credit: RangeCreditConfig): string =>
  `${credit.type} · Min: ${formatCurrency(credit.minLoan)} · Max: ${formatCurrency(credit.maxLoan)}`;

const MAX_LOAN_AMOUNT = 6_000_000;

const buildInitialPayload = (creditType: string, loanAmount: number, startDate: string, endDate: string): CreditCalculationPayload => ({
  creditType,
  loanAmount,
  startDate,
  endDate,
});

function App() {
  const [credits, setCredits] = useState<CreditConfig[]>([]);
  const [selectedCreditType, setSelectedCreditType] = useState<string>('');
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [{ start, end }, setDates] = useState(getDefaultDates());
  const [result, setResult] = useState<CreditCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadCredits = async () => {
      try {
        const data = await fetchCredits();
        setCredits(data);
        if (data.length > 0) {
          const firstCredit = data[0];
          setSelectedCreditType(firstCredit.type);
          if (isRangeCredit(firstCredit)) {
            setLoanAmount(firstCredit.minLoan);
          } else if (isTieredCredit(firstCredit)) {
            setLoanAmount(firstCredit.amounts[0]?.amount ?? 0);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load credits');
      }
    };

    loadCredits();
  }, []);

  const selectedCredit = useMemo(
    () => credits.find((credit) => credit.type === selectedCreditType),
    [credits, selectedCreditType],
  );

  const loanHint = useMemo(() => {
    if (!selectedCredit) {
      return '';
    }

    if (isTieredCredit(selectedCredit)) {
      return 'Enter a loan amount supported by this credit type.';
    }

    return `Allowed range: ${formatCurrency(selectedCredit.minLoan)} — ${formatCurrency(selectedCredit.maxLoan)}`;
  }, [selectedCredit]);

  const creditOptions = useMemo(
    () =>
      credits.map((credit) => ({
        type: credit.type,
        label: isRangeCredit(credit) ? mapRangeDescriptor(credit) : mapTierDescriptor(credit),
      })),
    [credits],
  );

  const isPayloadValid = useCallback(
    (
      payload: CreditCalculationPayload,
      credit: CreditConfig | undefined,
    ): credit is CreditConfig => {
      if (!credit) {
        setError('Select a credit type to continue');
        return false;
      }

      if (payload.loanAmount > MAX_LOAN_AMOUNT) {
        setError('Loan amount cannot exceed ETB 6,000,000');
        return false;
      }

      if (!payload.loanAmount || payload.loanAmount <= 0) {
        setError('Enter a positive loan amount');
        return false;
      }

      if (payload.startDate > payload.endDate) {
        setError('Start date must be on or before the end date');
        return false;
      }

      if (isRangeCredit(credit)) {
        if (payload.loanAmount < credit.minLoan || payload.loanAmount > credit.maxLoan) {
          setError('Loan amount must be within the allowed range for the selected credit');
          return false;
        }
      }

      if (isTieredCredit(credit)) {
        const match = findTierRangeForAmount(credit, payload.loanAmount);
        if (!match) {
          setError('Enter a valid loan amount for this credit type');
          return false;
        }
      }

      return true;
    },
    [],
  );

  const triggerCalculation = useCallback(
    async (payload: CreditCalculationPayload) => {
      try {
        setIsLoading(true);
        setError('');
        const response = await calculateLoan(payload);
        setResult(response);
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : 'Calculation failed');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedCreditType || loanAmount <= 0) {
      return;
    }

    const payload = buildInitialPayload(selectedCreditType, loanAmount, start, end);

    if (!isPayloadValid(payload, selectedCredit)) {
      return;
    }

    const debounce = setTimeout(() => {
      void triggerCalculation(payload);
    }, 250);

    return () => clearTimeout(debounce);
  }, [selectedCreditType, loanAmount, start, end, selectedCredit, isPayloadValid, triggerCalculation]);

  const handleCreditTypeChange = (value: string) => {
    setSelectedCreditType(value);
    const credit = credits.find((entry) => entry.type === value);
    if (credit) {
      if (isRangeCredit(credit)) {
        setLoanAmount(Math.min(credit.minLoan, MAX_LOAN_AMOUNT));
      } else if (isTieredCredit(credit)) {
        const ranges = buildTierRanges(credit);
        setLoanAmount(Math.min(ranges[0]?.min ?? 0, MAX_LOAN_AMOUNT));
      }
    }
  };

  const handleLoanAmountChange = (value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      setLoanAmount(0);
      return;
    }

    const clamped = Math.min(Math.max(numeric, 0), MAX_LOAN_AMOUNT);
    setLoanAmount(clamped);
  };

  const handleStartDateChange = (value: string) => {
    setDates((prev) => ({ ...prev, start: value }));
  };

  const handleEndDateChange = (value: string) => {
    setDates((prev) => ({ ...prev, end: value }));
  };

  const renderScheduleRow = (line: RepaymentScheduleLine, index: number) => (
    <tr key={`${line.date}-${index}`}>
      <td>{line.date}</td>
      <td>{formatCurrency(line.outstandingPrincipal)}</td>
      <td>{formatCurrency(line.dailyFee)}</td>
      <td>{formatCurrency(line.penaltyFee)}</td>
      <td>{formatCurrency(line.subtotal)}</td>
    </tr>
  );

  const minLoanBound = selectedCredit && isRangeCredit(selectedCredit) ? selectedCredit.minLoan : undefined;
  const specificMaxBound = selectedCredit && isRangeCredit(selectedCredit) ? selectedCredit.maxLoan : undefined;
  const maxLoanBound = specificMaxBound ? Math.min(specificMaxBound, MAX_LOAN_AMOUNT) : MAX_LOAN_AMOUNT;

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Telebirr Microcredit Loan Calculator</h1>
          <p className="app__subtitle">Plan repayments, understand fees, and stay on schedule.</p>
        </div>
      </header>

      <main className="app__content">
        <section className="card form-card">
          <h2>Loan Details</h2>
          <div className="form-grid">
            <label className="form-field">
              <span className="label">Credit type</span>
              <select value={selectedCreditType} onChange={(event) => handleCreditTypeChange(event.target.value)}>
                {creditOptions.map((option) => (
                  <option key={option.type} value={option.type}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span className="label">Loan amount</span>
              <div className="input-with-hint">
                <input
                  type="number"
                  min={minLoanBound}
                  max={maxLoanBound}
                  value={loanAmount || ''}
                  onChange={(event) => handleLoanAmountChange(event.target.value)}
                  placeholder="Enter loan amount"
                />
                {loanHint && <span className="hint">{loanHint}</span>}
              </div>
            </label>

            <label className="form-field">
              <span className="label">Start date</span>
              <input type="date" value={start} onChange={(event) => handleStartDateChange(event.target.value)} />
            </label>

            <label className="form-field">
              <span className="label">End date</span>
              <input type="date" value={end} onChange={(event) => handleEndDateChange(event.target.value)} />
            </label>
          </div>

          {error && <div className="alert alert--error">{error}</div>}
        </section>

        <section className="card results-card">
          <div className="results-card__header">
            <h2>Repayment Summary</h2>
            {isLoading && <span className="badge">Calculating…</span>}
          </div>

          {result ? (
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Loan amount</span>
                <strong className="summary-value">{formatCurrency(result.loanAmount)}</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">Loan period</span>
                <strong className="summary-value">{result.loanPeriodDays} days</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">
                  Facilitation fee
                  <span className="tooltip" title="Calculated as a percentage of the loan amount on disbursement">ⓘ</span>
                </span>
                <strong className="summary-value">{formatCurrency(result.facilitationFee)}</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">
                  Daily fee
                  <span className="tooltip" title="Accumulates for each day of the loan period">ⓘ</span>
                </span>
                <strong className="summary-value">{formatCurrency(result.dailyFee)}</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">
                  Penalty fee
                  <span className="tooltip" title="Applies when the repayment date exceeds the allowed payment period">ⓘ</span>
                </span>
                <strong className="summary-value">{formatCurrency(result.penaltyFee)}</strong>
              </div>
              <div className="summary-item summary-item--highlight">
                <span className="summary-label">Total repayment</span>
                <strong className="summary-value total">{formatCurrency(result.totalRepayment)}</strong>
              </div>
            </div>
          ) : (
            <p className="placeholder">Adjust the form above to calculate your repayment summary.</p>
          )}
        </section>

        {result && result.schedule.length > 0 && (
          <section className="card schedule-card">
            <div className="schedule-header">
              <h2>Repayment Schedule</h2>
              <p className="schedule-meta">Daily view based on your selected dates and fees.</p>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Principal</th>
                    <th>Daily fee</th>
                    <th>Penalty</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>{result.schedule.map((line, index) => renderScheduleRow(line, index))}</tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="app__footer">
        <p>
          All information is sourced from <a href="https://www.ethiotelecom.et/mela-micro-credit/">ethiotelecom.et/mela-micro-credit</a> and this website is not affiliated with Ethio telecom.
        </p>
        <p>This calculator reflects assumptions based on the referenced documentation and may not be fully accurate.</p>
        <p>Made by Nahom Weldemedhin.</p>
      </footer>
    </div>
  );
}

export default App;
