
import React from 'react';

interface StatProps {
  label: string;
  value: string | number;
  change?: number;
  changeIsPositive?: boolean;
  isLoading?: boolean;
}

const Stat: React.FC<StatProps> = ({ label, value, change, changeIsPositive, isLoading = false }) => {
  const changeColor = changeIsPositive === undefined ? 'text-gray-400' : changeIsPositive ? 'text-green-400' : 'text-red-400';
  const changeSymbol = changeIsPositive === undefined ? '' : changeIsPositive ? '▲' : '▼';

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{label}</h3>
      </div>
      {isLoading ? (
        <div className="mt-2 h-10 w-3/4 bg-gray-700 animate-pulse rounded"></div>
      ) : (
        <div className="mt-2">
          <p className="text-3xl font-bold text-white">{value}</p>
          {change !== undefined && (
            <p className={`text-sm font-medium ${changeColor} flex items-center`}>
              {changeSymbol} {Math.abs(change).toFixed(2)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Stat;
