import axios from 'axios';
import type { CreditType, CalculationResult } from '../types';

const API_URL = 'http://localhost:3000/api';

export const getCredits = async (): Promise<CreditType[]> => {
    const response = await axios.get(`${API_URL}/credits`);
    return response.data;
};

export const calculateLoan = async (
    creditType: string,
    amount: number,
    startDate: string,
    endDate: string
): Promise<CalculationResult> => {
    const response = await axios.post(`${API_URL}/calculate`, {
        creditType,
        amount,
        startDate,
        endDate,
    });
    return response.data;
};
