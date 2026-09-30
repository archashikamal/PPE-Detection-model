import React from 'react';

const StatCard = ({ icon: Icon, title, value, trend, colorClass = 'text-white' }) => {
  return (
    <div className="bg-surface-raised rounded-lg p-6 border border-surface-border flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-400 font-medium text-sm">{title}</h3>
        {Icon && <Icon className="w-5 h-5 text-gray-500" />}
      </div>
      <div className="flex items-end justify-between">
        <div className={`text-3xl font-mono font-bold ${colorClass}`}>
          {value}
        </div>
        {trend && (
          <div className="text-sm text-gray-400 mb-1">
            {trend}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
