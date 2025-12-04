import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, FileText, Sparkles, X, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Client, Call, EndReason } from '../types';
import { DataService } from '../services/dataService';
import { analyzeCallTranscript } from '../services/geminiService';

interface ConversationsProps {
  client: Client;
}

const Conversations: React.FC<ConversationsProps> = ({ client }) => {
  const [allCalls, setAllCalls] = useState<Call[]>([]); // Store ALL fetched calls
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]); // Store filtered calls for display
  
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  
  // Date Filter State
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'custom' | 'all'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    handleDatePreset('month'); // Default to this month
    
    // Initial Load
    loadCalls();

    // Auto-refresh
    const interval = setInterval(() => {
       loadCalls();
    }, 30000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [client.id]);

  // Apply filters whenever data or filter settings change
  useEffect(() => {
    applyFilters();
  }, [allCalls, startDate, endDate, searchTerm, statusFilter, dateRange]);

  const loadCalls = async () => {
    try {
        await DataService.sync(); // Sync DB first
        const fetchedCalls = await DataService.getCallsByClientId(client.id);
        if (isMounted.current) {
            setAllCalls(fetchedCalls);
        }
    } catch(e) { 
        console.error("Failed to load calls", e); 
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
      start.setDate(1); // First day of current month
    }

    setDateRange(preset);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const applyFilters = () => {
    let result = [...allCalls];

    // 1. Date Filter (If not "All Time")
    if (dateRange !== 'all' && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      result = result.filter(call => {
        const callDate = new Date(call.startedAt);
        return callDate >= start && callDate <= end;
      });
    }

    // 2. Search Filter (Phone Number)
    if (searchTerm) {
      result = result.filter(call => 
        call.customerPhone.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 3. Status Filter
    if (statusFilter !== 'All Statuses') {
      result = result.filter(call => 
        call.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    setFilteredCalls(result);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handlePlay = (url: string) => {
    if (audio) {
      audio.pause();
      if (audio.src === url && isPlaying) {
        setIsPlaying(false);
        return;
      }
    }
    const newAudio = new Audio(url);
    newAudio.onended = () => setIsPlaying(false);
    newAudio.play();
    setAudio(newAudio);
    setIsPlaying(true);
  };

  const handleAnalyze = async (call: Call) => {
    if (!call.transcript) return;
    setAnalyzing(true);
    const result = await analyzeCallTranscript(call.transcript);
    setAnalysis(result);
    setAnalyzing(false);
  };

  const closeModal = () => {
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
    setSelectedCall(null);
    setAnalysis(null);
  };

  // Format Helper for End Reasons
  const formatEndReason = (reason: string) => {
    switch (reason) {
      case EndReason.CUSTOMER_ENDED: return { text: 'Customer Ended', style: 'bg-blue-50 text-blue-700 border-blue-100' };
      case EndReason.ASSISTANT_ENDED: return { text: 'Assistant Ended', style: 'bg-green-50 text-green-700 border-green-100' };
      case EndReason.SILENCE_TIMEOUT: return { text: 'Silence Timeout', style: 'bg-amber-50 text-amber-700 border-amber-100' };
      case EndReason.ERROR: return { text: 'System Error', style: 'bg-red-50 text-red-700 border-red-100' };
      default: return { text: reason, style: 'bg-slate-50 text-slate-600 border-slate-200' };
    }
  };

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCalls = filteredCalls.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage);

  const paginate = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
           <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
           <p className="text-slate-500">Monitor and review call logs</p>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live Updates
        </div>
      </div>

      {/* Controls Container */}
      <div className="flex flex-col gap-4 mb-4">
        
        {/* Date Filters */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
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

        {/* Search & Status Filters */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 flex gap-4 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by phone number..." 
              className="w-full pl-10 pr-4 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-2 border border-slate-300 rounded-md bg-white text-slate-600 outline-none focus:border-brand-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All Statuses</option>
            <option>Completed</option>
            <option>Failed</option>
            <option>Ongoing</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Date & Time</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Customer</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Duration</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Reason</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentCalls.length > 0 ? (
                currentCalls.map((call) => {
                  const reasonInfo = formatEndReason(call.endReason);
                  return (
                    <tr key={call.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(call.startedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {call.customerPhone}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          call.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {call.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${reasonInfo.style}`}>
                          {reasonInfo.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedCall(call)}
                          className="text-brand-600 hover:text-brand-700 font-medium text-sm flex items-center gap-1"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No calls found for the selected date range or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredCalls.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-900">{indexOfFirstItem + 1}</span> to <span className="font-medium text-slate-900">{Math.min(indexOfLastItem, filteredCalls.length)}</span> of <span className="font-medium text-slate-900">{filteredCalls.length}</span> results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-slate-700 px-2">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over / Modal for Details */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Call Details</h2>
                <p className="text-slate-500 text-sm">ID: {selectedCall.id}</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Audio Player */}
            <div className="bg-slate-100 p-4 rounded-lg mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Recording</p>
                <p className="text-sm font-medium">{Math.floor(selectedCall.durationSeconds / 60)}:{(selectedCall.durationSeconds % 60).toString().padStart(2, '0')}</p>
              </div>
              <button 
                onClick={() => selectedCall.recordingUrl && handlePlay(selectedCall.recordingUrl)}
                className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center hover:bg-brand-700 transition shadow-md"
              >
                {isPlaying && audio?.src === selectedCall.recordingUrl ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
              </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500">End Reason</p>
                <p className="text-sm font-medium text-slate-900">{selectedCall.endReason}</p>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500">Assistant ID</p>
                <p className="text-sm font-medium text-slate-900 truncate">{selectedCall.assistantId}</p>
              </div>
            </div>

            {/* AI Analysis Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-600" />
                  AI Insights
                </h3>
                {!analysis && (
                  <button 
                    onClick={() => handleAnalyze(selectedCall)}
                    disabled={analyzing || !selectedCall.transcript}
                    className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium hover:bg-purple-100 disabled:opacity-50"
                  >
                    {analyzing ? 'Analyzing...' : 'Generate Insight'}
                  </button>
                )}
              </div>
              
              {analysis ? (
                 <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg space-y-3">
                   <div>
                     <span className="text-xs font-bold text-purple-800 uppercase">Summary</span>
                     <p className="text-sm text-purple-900 mt-1 leading-relaxed">{analysis.summary}</p>
                   </div>
                   <div>
                     <span className="text-xs font-bold text-purple-800 uppercase">Sentiment</span>
                     <div className="flex items-center gap-2 mt-1">
                       <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium capitalize ${
                         analysis.sentiment === 'positive' ? 'bg-green-200 text-green-800' :
                         analysis.sentiment === 'negative' ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800'
                       }`}>
                         {analysis.sentiment}
                       </span>
                     </div>
                   </div>
                   <div>
                     <span className="text-xs font-bold text-purple-800 uppercase">Key Points</span>
                     <ul className="mt-1 space-y-1">
                       {analysis.keyPoints?.map((point: string, idx: number) => (
                         <li key={idx} className="text-sm text-purple-900 flex items-start gap-2">
                           <span className="block w-1 h-1 mt-2 rounded-full bg-purple-400 flex-shrink-0"></span>
                           {point}
                         </li>
                       ))}
                     </ul>
                   </div>
                 </div>
              ) : (
                <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center">
                  <p className="text-sm text-slate-500">Click 'Generate Insight' to analyze this call using Gemini 2.5 Flash.</p>
                </div>
              )}
            </div>

            {/* Transcript */}
            <div>
               <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                 <FileText size={16} /> Transcript
               </h3>
               <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono">
                 {selectedCall.transcript || "No transcript available."}
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Conversations;