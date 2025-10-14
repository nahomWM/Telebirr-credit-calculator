import React from 'react';
import type { CalculationResult } from '../types';
import { Info } from 'lucide-react';

interface ResultCardProps {
    result: CalculationResult | null;
    loading: boolean;
    error: string | null;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, loading, error }) => {
    if (loading) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-6 rounded-xl shadow-lg border border-red-100">
                <h3 className="text-red-800 font-semibold mb-2">Error</h3>
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-lg text-center text-gray-500">
                <Info className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Enter loan details to see repayment breakdown.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Repayment Summary</h2>

            <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <span className="text-gray-600">Loan Period</span>
                    <span className="font-semibold text-gray-900">{result.loanPeriodDays} Days</span>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Principal</span>
                        <span className="text-gray-900">{result.breakdown.principal.toFixed(2)} ETB</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Facilitation Fee</span>
                        <span className="text-gray-900">{result.breakdown.facilitation.toFixed(2)} ETB</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Daily Fee</span>
                        <span className="text-gray-900">{result.breakdown.daily.toFixed(2)} ETB</span>
                    </div>
                    {result.breakdown.penalty > 0 && (
                        <div className="flex justify-between items-center text-sm text-red-600">
                            <span>Penalty Fee</span>
                            <span>{result.breakdown.penalty.toFixed(2)} ETB</span>
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-gray-100 mt-4">
                    <div className="flex justify-between items-end">
                        <span className="text-gray-600 font-medium">Total Repayment</span>
                        <span className="text-3xl font-bold text-blue-600">
                            {result.totalRepayment.toFixed(2)} <span className="text-sm font-normal text-gray-500">ETB</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultCard;
