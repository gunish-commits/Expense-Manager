// components/dashboard/CategorySpendChart.tsx
'use client';

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

const COLORS = ['#4F46E5', '#16A34A', '#F97316', '#0EA5E9', '#D946EF', '#EAB308'];

interface CategorySpendChartProps {
  chartData: Array<{ name: string; value: number }>;
}

export default function CategorySpendChart({ chartData }: CategorySpendChartProps) {
  if (chartData.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-text-secondary text-[13px]">
        No expenses logged during this period.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border p-4 rounded-xl shadow-subtle text-left">
      <h3 className="font-semibold text-[17px] text-text-primary mb-4 flex items-center gap-1.5 leading-[1.2]">
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
        <div className="w-full sm:w-1/2 space-y-2 flex flex-col justify-center">
          {chartData.slice(0, 4).map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between text-[13px] text-text-secondary">
              <div className="flex items-center gap-2">
                <span 
                  className="w-2.5 h-2.5 rounded-full inline-block" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-normal truncate max-w-[100px] text-text-primary">{entry.name}</span>
              </div>
              <span className="font-medium text-text-primary">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
