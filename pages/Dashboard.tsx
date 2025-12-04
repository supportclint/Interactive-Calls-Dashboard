import React, { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Clock, PhoneCall, AlertTriangle, TrendingUp, CreditCard, ArrowUpCircle, Infinity, X, Send, Edit3, Calendar, FileText, Bell, Info, RefreshCw } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { Client, Call, Transaction, Notification } from '../types';
import { DataService } from '../services/dataService';
import { PLANS, GHL_PAYMENT_URL, API_BASE_URL } from '../constants';

interface DashboardProps {
  client: Client;
}

const CUSTOM_RATE = 0.35;

const Dashboard: React.FC<DashboardProps> = ({ client: initialClient }) => {
  const [client, setClient] = useState<Client>(initialClient);
  const [allCalls, setAllCalls] = useState<Call[]>([]); 
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalMinutes: 0, totalCalls: 0, reasonCounts: {} as Record<string, number> });
  
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'custom' | 'all'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showOveragesModal, setShowOveragesModal] = useState(false);
  const [isEnablingOverages, setIsEnablingOverages] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const isMounted = useRef(true);

  useEffect(() => {
    setClient(initialClient);
  }, [initialClient]);

  useEffect(() => {
    handleDatePreset('month');
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    const intervalId = setInterval(() => {
      fetchData(true); 
    }, 30000);
    return () => {
      isMounted.current = false;
      clearInterval(intervalId);
    };
  }, [client.id]);

  useEffect(() => {
    if (allCalls.length > 0) {
      applyDateFilter();
    } else {
      setFilteredCalls([]);
      setStats({ totalMinutes: 0, totalCalls: 0, reasonCounts: {} });
    }
  }, [allCalls, startDate, endDate, dateRange]);

  useEffect(() => {
    if (!loading && client) {
        const usagePercent = (client.usedMinutes / client.minuteLimit) * 100;
        if (client.overagesEnabled === false && usagePercent >= 80) {
            const timer = setTimeout(() => setShowOveragesModal(true), 1000);
            return () => clearTimeout(timer);
        }
    }
  }, [loading, client.id, client.usedMinutes, client.overagesEnabled]);

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      await DataService.sync(); 
      const fetchedCalls = await DataService.getCallsByClientId(client.id);
      const latestClient = await DataService.getClientById(client.id);
      
      if (isMounted.current) {
        if (latestClient) {
            setClient(latestClient);
        }
        setAllCalls(fetchedCalls);
        if (!isBackground) setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      if (isMounted.current && !isBackground) setLoading(false);
    }
  };

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
      start.setDate(1);
    }

    setDateRange(preset);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const applyDateFilter = () => {
    if (dateRange === 'all') {
        setFilteredCalls(allCalls);
        calculateStats(allCalls);
        return;
    }
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = allCalls.filter(call => {
      const callDate = new Date(call.startedAt);
      return callDate >= start && callDate <= end;
    });

    setFilteredCalls(filtered);
    calculateStats(filtered);
  };

  const calculateStats = (callsToProcess: Call[]) => {
    const totalMinutes = callsToProcess.reduce((acc, call) => acc + (call.durationSeconds / 60), 0);
    const totalCalls = callsToProcess.length;
    const reasonCounts = callsToProcess.reduce((acc, call) => {
      acc[call.endReason] = (acc[call.endReason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    setStats({
      totalMinutes,
      totalCalls,
      reasonCounts
    });
  };

  const handleEnableOverages = async () => {
    setIsEnablingOverages(true);
    try {
      await DataService.toggleClientOverages(client.id, true);
      const updatedClient = await DataService.getClientById(client.id);
      if (updatedClient) setClient(updatedClient);
      setShowOveragesModal(false);
    } catch (e) {
      console.error("Failed to enable overages", e);
    } finally {
      setIsEnablingOverages(false);
    }
  };

  // PAYMENT INTEGRATION (Node Backend)
  const handleTopUpRequest = async () => {
    let amount = 0;
    let price = 0;

    if (selectedPlan === 'CUSTOM') {
      amount = parseInt(customMinutes);
      price = amount * CUSTOM_RATE;
    } else {
      const plan = PLANS.find(p => p.name === selectedPlan);
      if (plan) {
          amount = plan.minutes;
          price = plan.price;
      }
    }

    if (!amount || isNaN(amount) || amount <= 0) return;
    
    setIsProcessing(true);

    try {
        const response = await fetch(`${API_BASE_URL}/create-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: client.id,
                amount: price, 
                minutes: amount,
                plan_name: selectedPlan || 'Custom'
            })
        });

        const data = await response.json();

        if (data.url && data.url !== '#') {
            window.location.href = data.url;
        } else {
            const errorMsg = data.error || "Payment system not configured.";
            alert(`Unable to proceed to payment.\n\nSystem Message: ${errorMsg}`);
            setIsProcessing(false);
        }
        
    } catch (error) {
        console.error("Payment creation failed", error);
        alert("Payment system unavailable. Please check your internet connection.");
        setIsProcessing(false);
    }
  };

  const formatMinutesToDuration = (decimalMinutes: number) => {
    if (!decimalMinutes) return '0m 0s';
    const totalSeconds = decimalMinutes * 60;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
  };

  const getBillingCycleDates = () => {
    if (!client.createdAt) return { start: 'N/A', end: 'N/A' };
    const created = new Date(client.createdAt);
    const now = new Date();
    let cycleStart = new Date(now.getFullYear(), now.getMonth(), created.getDate());
    if (now < cycleStart) {
      cycleStart.setMonth(cycleStart.getMonth() - 1);
    }
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    return {
      start: cycleStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      end: cycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  };

  const usagePercentage = (client.usedMinutes / client.minuteLimit) * 100;
  const isNearLimit = usagePercentage >= 80;
  const billingCycle = getBillingCycleDates();

  const chartMap = new Map<string, number>();
  filteredCalls.forEach(call => {
    const dateKey = new Date(call.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const currentVal = chartMap.get(dateKey) || 0;
    chartMap.set(dateKey, currentVal + (call.durationSeconds / 60));
  });

  const finalChartData = Array.from(chartMap.entries()).map(([date, duration]) => ({
    date,
    duration: Math.round(duration * 100) / 100
  })).reverse().reverse();

  if (loading) return <div className="p-8 flex justify-center text-slate-500">Loading analytics...</div>;

  const transactions = client.transactions || [];
  const notifications = client.notifications || [];

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Welcome back, {client.name}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => !client.overagesEnabled && setShowOveragesModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              client.overagesEnabled 
                ? 'bg-green-50 text-green-700 border-green-200 cursor-default' 
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 cursor-pointer animate-pulse'
            }`}
            title={client.overagesEnabled ? "Overages Active" : "Enable Overages"}
          >
            <Infinity size={14} />
            {client.overagesEnabled ? 'Overages Active' : 'Enable Overages'}
          </button>

          <div className="text-right">
             <div className="flex justify-between items-center mb-1">
                <div className="text-sm font-medium text-slate-500">Monthly Usage</div>
             </div>
             <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
               <div 
                  className={`h-full rounded-full transition-all duration-500 ${isNearLimit ? 'bg-red-500' : 'bg-brand-500'}`} 
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
               />
             </div>
             <div className="flex justify-between items-start mt-1">
                <p className={`text-xs ${isNearLimit ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                  {Math.round(client.usedMinutes)} / {client.minuteLimit} mins
                </p>
                <p className="text-[10px] text-slate-400">
                  {billingCycle.start} - {billingCycle.end}
                </p>
             </div>
          </div>

          <button 
            onClick={() => setIsTopUpOpen(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors h-10"
          >
            <CreditCard size={18} /> Top Up
          </button>
        </div>
      </div>

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

      {isNearLimit && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 animate-in slide-in-from-top-2">
          <AlertTriangle className="text-red-600 mt-0.5" size={20} />
          <div>
            <h4 className="text-red-800 font-bold">Usage Warning</h4>
            <p className="text-red-700 text-sm">
              You have used {Math.round(usagePercentage)}% of your monthly minute limit. 
              Please upgrade your plan or top up to avoid service interruption.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard 
          title="Total Call Minutes" 
          value={formatMinutesToDuration(stats.totalMinutes)} 
          icon={Clock} 
          description="Duration in selected period"
        />
        <StatsCard 
          title="Total Calls" 
          value={stats.totalCalls} 
          icon={PhoneCall} 
          trendUp={true}
          description="Calls in selected period"
        />
        <StatsCard 
          title="Avg Call Duration" 
          value={formatMinutesToDuration(stats.totalCalls > 0 ? stats.totalMinutes / stats.totalCalls : 0)} 
          icon={TrendingUp} 
          description="Average time per conversation"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Call Volume Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={finalChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="duration" fill="#0d9488" radius={[4, 4, 0, 0]} name="Minutes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FileText size={20} className="text-slate-500" /> Recent Transactions
            <button 
                onClick={() => fetchData()} 
                className="ml-auto text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                title="Refresh Transactions"
            >
                <RefreshCw size={12} /> Refresh
            </button>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 rounded-l-lg">Date</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2 rounded-r-lg text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {transactions.length > 0 ? (
                  transactions.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-500">{item.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{item.description}</td>
                      <td className="px-4 py-3 text-slate-600">{item.amount}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            item.status === 'Paid' || item.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                            item.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                    <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic">No transaction history.</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Bell size={20} className="text-slate-500" /> Notifications
          </h3>
          <div className="space-y-4">
            {notifications.length > 0 ? (
                notifications.map((note) => (
                <div key={note.id} className="flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={`mt-1 p-2 rounded-full shrink-0 ${
                    note.type === 'warning' ? 'bg-amber-100 text-amber-600' : 
                    note.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                    {note.type === 'warning' ? <AlertTriangle size={16} /> : 
                    note.type === 'success' ? <ArrowUpCircle size={16} /> : <Info size={16} />}
                    </div>
                    <div>
                    <h4 className="text-sm font-bold text-slate-800">{note.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{note.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">{note.date}</span>
                    </div>
                </div>
                ))
            ) : (
                <div className="text-center text-slate-400 py-6 italic">No new notifications.</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modals omitted for brevity - they use existing logic */}
    </div>
  );
};

export default Dashboard;