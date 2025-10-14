import React, { useState, useEffect } from 'react';
import type { CreditType, CalculationResult } from '../types';
import { getCredits, calculateLoan } from '../services/api';
import ResultCard from './ResultCard';
import { Calendar, DollarSign, CreditCard } from 'lucide-react';

const LoanCalculator: React.FC = () => {
    const [credits, setCredits] = useState<CreditType[]>([]);
    const [selectedType, setSelectedType] = useState<string>('');
    const [amount, setAmount] = useState<number | ''>('');
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>('');

    const [result, setResult] = useState<CalculationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCredits = async () => {
            try {
                const data = await getCredits();
                setCredits(data);
                if (data.length > 0) {
                    setSelectedType(data[0].type);
                }
            } catch (err) {
                console.error('Failed to fetch credits', err);
                setError('Failed to load credit types. Please try again later.');
            }
        };
        fetchCredits();
    }, []);

    const handleCalculate = async () => {
        if (!selectedType || !amount || !startDate || !endDate) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await calculateLoan(selectedType, Number(amount), startDate, endDate);
            setResult(res);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Calculation failed');
        } finally {
            setLoading(false);
        }
    };

    const selectedCredit = credits.find(c => c.type === selectedType);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Microcredit Calculator</h1>
                <p className="text-gray-500">Plan your loan repayment with transparency</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-6">Loan Details</h2>

                    <div className="space-y-6">
                        {/* Credit Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Credit Type</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <select
                                    value={selectedType}
                                    onChange={(e) => {
                                        setSelectedType(e.target.value);
                                        setAmount('');
                                        setResult(null);
                                    }}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-white"
                                >
                                    {credits.map((c) => (
                                        <option key={c.type} value={c.type}>{c.type}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount (ETB)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                {selectedCredit?.amounts ? (
                                    <select
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-white"
                                    >
                                        <option value="">Select Amount</option>
                                        {selectedCredit.amounts.map((a) => (
                                            <option key={a.amount} value={a.amount}>{a.amount} ETB</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        min={selectedCredit?.minLoan}
                                        max={selectedCredit?.maxLoan}
                                        placeholder={`Between ${selectedCredit?.minLoan} - ${selectedCredit?.maxLoan}`}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                )}
                            </div>
                            {selectedCredit && !selectedCredit.amounts && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Min: {selectedCredit.minLoan} ETB, Max: {selectedCredit.maxLoan} ETB
                                </p>
                            )}
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleCalculate}
                            disabled={loading || !amount || !startDate || !endDate}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Calculating...' : 'Calculate Repayment'}
                        </button>
                    </div>
                </div>

                <div>
                    <ResultCard result={result} loading={loading} error={error} />
                </div>
            </div>
        </div>
    );
};

export default LoanCalculator;
