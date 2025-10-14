import { CreditCalculationPayload, CreditCalculationResult, CreditConfig } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const buildUrl = (path: string): string => `${API_BASE}${path}`;

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  return response.json() as Promise<T>;
};

export const fetchCredits = async (): Promise<CreditConfig[]> => {
  const response = await fetch(buildUrl('/api/credits'), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return handleResponse<CreditConfig[]>(response);
};

export const calculateLoan = async (payload: CreditCalculationPayload): Promise<CreditCalculationResult> => {
  const response = await fetch(buildUrl('/api/calculate'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<CreditCalculationResult>(response);
};
