import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, PhoneCall, Clock, Activity, Calendar } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { DataService } from '../services/dataService';
import { Client, Call } from '../types';

const COLORS = ['#0d9488', '#f59e0b', '#ef4444', '#64748b', '#8b5cf6'];

const AdminAnalytics: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [calls, setCalls] = useState<Call[]>([]); // All fetched calls
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]); // Calls in date range
  const [loading, setLoading] = useState(true);

  // Date Filter State
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'custom' | 'all'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Initial Load
  useEffect(() => {
    handleDatePreset('month');
  }, []);

  // Handle Data Fetching based on Date Range Selection
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await DataService.sync(); // Sync DB once globally before fetching bulk records
        const fetchedClients = await DataService.getClients();
        setClients(fetchedClients);

        // If "All Time" is selected, fetch deeper history (e.g. from 2024)
        // Otherwise, fetch from start of month (default optimization)
        let fetchStartDate: Date | undefined;
        if (dateRange === 'all') {
            fetchStartDate = new Date('2024-01-01');
        }

        const fetchedCalls = await DataService.getAllCalls(fetchStartDate);
        setCalls(fetchedCalls);
      } catch (error) {
        console.error("Failed to load analytics data", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dateRange]); // Re-fetch when dateRange mode changes (specifically for 'all')

  // Apply local filtering when calls or specific dates change
  useEffect(() => {
    if (dateRange === 'all') {
        setFilteredCalls(calls);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const filtered = calls.filter(call => {
        const callDate = new Date(call.startedAt);
        return callDate >= start && callDate <= end;
      });
      setFilteredCalls(filtered);
    } else {
      // Fallback
      setFilteredCalls(calls);
    }
  }, [calls, startDate, endDate, dateRange]);

  const handleDatePreset = (preset: 'week' | 'month' | 'all') => {
    const end = new Date();
    let start = new Date();

    if (preset === 'all') {
        setDateRange('all');
        setStartDate('');
        setEndDate('');
        return;
    }

    if (preset === 'week') {
      start.setDate(end.getDate() - 7);
    } else {
      start.setDate(1); // First day of current month
    }

    setDateRange(preset);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  if (loading) return <div className="p-8 flex justify-center text-slate-500">Loading global analytics...</div>;

  // Calculate Stats based on Filtered Calls
  const totalClients = clients.length;
  const totalCalls = filteredCalls.length;
  const totalSeconds = filteredCalls.reduce((acc, call) => acc + call.durationSeconds, 0);
  
  // Helper to format seconds to "Xm Ys"
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };
  
  // Chart Data 1: Minutes Used by Client (In Selected Period)
  const clientUsageMap = new Map<string, number>();
  filteredCalls.forEach(call => {
    const current = clientUsageMap.get(call.clientId) || 0;
    clientUsageMap.set(call.clientId, current + (call.durationSeconds / 60));
  });

  const clientUsageData = clients
    .map(client => ({
      name: client.name,
      minutes: Math.round(clientUsageMap.get(client.id) || 0)
    }))
    .filter(item => item.minutes > 0) // Only show active clients in this period
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10); // Show top 10

  // Chart Data 2: Global Call End Reasons (In Selected Period)
  const reasonCounts = filteredCalls.reduce((acc, call) => {
    acc[call.endReason] = (acc[call.endReason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(reasonCounts).map(reason => ({
    name: reason.replace(/-/g, ' '),
    value: reasonCounts[reason]
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Global Analytics</h1>
          <p className="text-slate-500">Overview of system-wide performance and usage.</p>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4 overflow-x-auto">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Date Range:</span>
        </div>
        
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button 
            onClick={() => handleDatePreset('week')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'week' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Last 7 Days
          </button>
          <button 
            onClick={() => handleDatePreset('month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'month' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            This Month
          </button>
          <button 
            onClick={() => handleDatePreset('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'all' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            All Time
          </button>
          <button 
            onClick={() => setDateRange('custom')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'custom' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Custom
          </button>
        </div>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">From</span>
            <input 
              type="date" 
              className="text-sm border border-slate-300 rounded px-2 py-1 focus:border-brand-500 outline-none text-slate-600"
              value={startDate}
              disabled={dateRange === 'all'}
              onChange={(e) => { setStartDate(e.target.value); setDateRange('custom'); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">To</span>
            <input 
              type="date" 
              className="text-sm border border-slate-300 rounded px-2 py-1 focus:border-brand-500 outline-none text-slate-600"
              value={endDate}
              disabled={dateRange === 'all'}
              onChange={(e) => { setEndDate(e.target.value); setDateRange('custom'); }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Clients" 
          value={totalClients} 
          icon={Users} 
        />
        <StatsCard 
          title="Total Calls" 
          value={totalCalls} 
          icon={PhoneCall} 
          description="In selected period"
        />
        <StatsCard 
          title="System Minutes" 
          value={formatDuration(totalSeconds)} 
          icon={Clock} 
          description="In selected period"
        />
        <StatsCard 
          title="Avg Call Duration" 
          value={formatDuration(totalCalls > 0 ? totalSeconds / totalCalls : 0)} 
          icon={Activity} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients by Usage */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Clients by Usage (Minutes)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientUsageData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="minutes" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={20} name="Minutes Used" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global End Reasons */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Global Call Outcomes</h3>
          <div className="h-80 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No data available for selected period</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;