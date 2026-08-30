// components/dashboard/CategorySpendChart.tsx
'use client';

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

const COLORS = ['#2C3E66', '#D4A24C', '#E4572E', '#3E588F', '#8C867A', '#5A6B7C', '#E6C587'];

interface CategorySpendChartProps {
  chartData: Array<{ name: string; value: number }>;
}

export default function CategorySpendChart({ chartData }: CategorySpendChartProps) {
  if (chartData.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
        No expenses logged during this period.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-3xl">
      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-1.5">
        <TrendingUp className="w-4 h-4 text-primary" />
        Spending Breakdown
      </h3>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full h-48 sm:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `₹${value}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Custom legend */}
        <div className="w-full sm:w-1/2 space-y-1.5 flex flex-col justify-center">
          {chartData.slice(0, 4).map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span 
                  className="w-2.5 h-2.5 rounded-full inline-block" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-medium truncate max-w-[80px]">{entry.name}</span>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
