import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  description?: string;
  alert?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, trendUp, description, alert }) => {
  return (
    <div className={`bg-white p-6 rounded-xl shadow-sm border ${alert ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
        <div className={`p-2 rounded-lg ${alert ? 'bg-red-100 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${alert ? 'text-red-900' : 'text-slate-900'}`}>{value}</span>
        {trend && (
          <span className={`text-sm font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trend}
          </span>
        )}
      </div>
      {description && <p className="text-slate-500 text-sm mt-2">{description}</p>}
    </div>
  );
};

export default StatsCard;
