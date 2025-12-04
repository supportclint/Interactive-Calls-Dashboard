import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, EyeOff, Copy, Info, Lock, Save, X, Server, ArrowRight, ArrowLeft, CheckCircle, XCircle, Clock, Edit3, Trash2, Shield, FileText, Send, CreditCard, Mail, RefreshCw, Link2, Download, FileClock } from 'lucide-react';
import { Client, TopUpRequest, AdminProfile, Transaction } from '../types';
import { DataService } from '../services/dataService';
import { PLANS } from '../constants';

interface AdminPanelProps {
  onImpersonate: (client: Client) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onImpersonate }) => {
  const [activeTab, setActiveTab] = useState<'clients' | 'admins' | 'billing'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<TopUpRequest[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // Billing Modal State
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [billingClient, setBillingClient] = useState<Client | null>(null);
  const [billingAction, setBillingAction] = useState<'view' | 'send'>('view');
  const [reportEmail, setReportEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Client Registration Form State
  const [selectedPlan, setSelectedPlan] = useState<string>('CONNECT');
  const [customLimit, setCustomLimit] = useState<string>('');

  const [formData, setFormData] = useState({
    clientName: '',
    minuteLimit: 2000,
    vapiApiKey: '',
    vapiPublicKey: '',
    webhookUrl: '',
    language: 'English',
    twoFactor: false,
    memberName: '',
    memberLoginId: '',
    memberEmail: '',
    memberPassword: '',
    confirmPassword: ''
  });

  // Admin Registration Form State
  const [adminFormData, setAdminFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (selectedPlan === 'CUSTOM') {
      const val = parseInt(customLimit);
      setFormData(prev => ({ ...prev, minuteLimit: isNaN(val) ? 0 : val }));
    } else {
      const plan = PLANS.find(p => p.name === selectedPlan);
      if (plan) {
        setFormData(prev => ({ ...prev, minuteLimit: plan.minutes }));
      }
    }
  }, [selectedPlan, customLimit]);

  const loadData = async () => {
    const [clientsData, adminsData, requestsData] = await Promise.all([
      DataService.getClients(),
      DataService.getAdmins(),
      DataService.getPendingRequests()
    ]);
    setClients(clientsData);
    setAdmins(adminsData);
    setPendingRequests(requestsData);
  };

  const handleResolveRequest = async (requestId: string, approved: boolean) => {
    try {
      await DataService.resolveTopUpRequest(requestId, approved);
      await loadData();
    } catch (error) {
      console.error("Failed to resolve request", error);
    }
  };

  const handleOpenBillingModal = (client: Client, action: 'view' | 'send') => {
    setBillingClient(client);
    setBillingAction(action);
    setReportEmail(client.email);
    setBillingModalOpen(true);
  };

  const handleFinalizeSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingClient || !reportEmail) return;

    setIsSending(true);
    try {
        await DataService.sendBillingReport(billingClient.id, reportEmail);
        alert(`Billing report sent successfully to ${reportEmail}!`);
        setBillingModalOpen(false);
    } catch (e) {
        alert("Failed to send report.");
    } finally {
        setIsSending(false);
    }
  };

  const calculateBill = (client: Client) => {
    const plan = PLANS.find(p => p.minutes === client.planLimit);
    let basePrice = plan ? plan.price : 0;
    if (!plan && client.planLimit > 0) basePrice = client.planLimit * 0.35;

    // Top-Ups
    let topUpTotal = 0;
    let topUpMinutes = 0;
    if (client.transactions && Array.isArray(client.transactions)) {
        client.transactions.forEach(t => {
            if (t.status === 'Paid' || t.status === 'Approved') {
                let amount = 0;
                if (typeof t.amount === 'string') {
                     const amountStr = t.amount.replace(/[^0-9.]/g, '');
                     amount = parseFloat(amountStr);
                } else if (typeof t.amount === 'number') {
                     amount = t.amount;
                }
                
                if (!isNaN(amount)) topUpTotal += amount;
                
                if (t.description) {
                    const match = t.description.match(/\((\d+[\d,]*)\s*Mins\)/i);
                    if (match) {
                        topUpMinutes += parseInt(match[1].replace(/,/g, ''));
                    }
                }
            }
        });
    }

    const overageMinutes = 0;
    const overageCost = 0;

    let status = 'Paid';
    if (client.minuteLimit <= 0) {
        status = 'Inactive';
    }

    let lastPayment = { date: '-', amount: '-' };
    if (client.transactions && client.transactions.length > 0) {
        const latest = client.transactions[0];
        lastPayment = {
            date: latest.date,
            amount: latest.amount
        };
    }

    return {
        planName: plan ? plan.name : 'Custom Base Plan',
        baseLimit: client.planLimit || client.minuteLimit,
        basePrice,
        topUpTotal,
        topUpMinutes,
        overageMinutes,
        overageCost,
        total: basePrice + topUpTotal + overageCost,
        usage: client.usedMinutes,
        limit: client.minuteLimit,
        status,
        lastPayment,
        transactions: client.transactions || []
    };
  };

  const handleDownloadCSV = () => {
    if (!billingClient) return;

    const bill = calculateBill(billingClient);
    const date = new Date().toLocaleDateString();
    
    let csvContent = [
        ["Invoice Details", "Interactive Calls Dashboard"],
        ["Date", date],
        ["Client Name", billingClient.name],
        ["Client Email", billingClient.email],
        [],
        ["Description", "Details", "Amount (AUD)"],
        ["Base Subscription", `${bill.planName} (${bill.baseLimit.toLocaleString()} mins)`, bill.basePrice.toFixed(2)],
        ["Top-Ups / Extras", `${bill.topUpMinutes.toLocaleString()} mins added`, bill.topUpTotal.toFixed(2)],
        ["Usage", `${Math.round(bill.usage).toLocaleString()} mins used`, "-"],
        ["Total Invoiced", "", bill.total.toFixed(2)],
        [],
        ["Transaction History"],
        ["Date", "Description", "Amount", "Status"]
    ].map(e => e.join(",")).join("\n");

    const txnRows = bill.transactions.map(t => [t.date, t.description, t.amount, t.status].join(","));
    csvContent += "\n" + txnRows.join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Invoice_${billingClient.name.replace(/\s+/g, '_')}_${date.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateAutoCredentials = () => {
    const baseId = formData.clientName
      ? formData.clientName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10) 
      : 'user';
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    const loginId = `${baseId}${randomSuffix}`;

    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setFormData(prev => ({ 
      ...prev, 
      memberLoginId: loginId,
      memberPassword: pass, 
      confirmPassword: pass 
    }));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!formData.clientName || !formData.minuteLimit || formData.minuteLimit <= 0) {
      alert("Please enter a Company Name and select a valid Plan.");
      return;
    }

    if (!editingClient && (!formData.memberLoginId || !formData.memberPassword)) {
        generateAutoCredentials();
    }

    setCurrentStep(2);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === 1) {
        if (!formData.clientName || !formData.minuteLimit || formData.minuteLimit <= 0) {
             alert("Please enter a Company Name and select a valid Plan.");
             return;
        }
        generateAutoCredentials();
        setCurrentStep(2);
        return;
    }

    if (!formData.clientName || !formData.memberLoginId) return;
    
    if (formData.memberPassword || !editingClient) {
        if (formData.memberPassword !== formData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }
    }

    const clientData: any = {
      name: formData.clientName,
      email: formData.memberEmail || `${formData.memberLoginId}@example.com`,
      minuteLimit: formData.minuteLimit,
      // SAFE TRIM
      vapiApiKey: formData.vapiApiKey ? formData.vapiApiKey.trim() : '',
      vapiPublicKey: formData.vapiPublicKey ? formData.vapiPublicKey.trim() : '',
      webhookUrl: formData.webhookUrl ? formData.webhookUrl.trim() : '',
      language: formData.language,
      memberLoginId: formData.memberLoginId
    };

    if (editingClient) {
        const updatedClient: Client = {
            ...editingClient,
            ...clientData,
            password: formData.memberPassword ? formData.memberPassword : editingClient.password
        };
        await DataService.updateClient(updatedClient);
    } else {
        if (!formData.memberPassword) {
            alert("Password is required for new clients.");
            return;
        }
        clientData.memberPassword = formData.memberPassword;
        await DataService.addClient(clientData);
    }
    
    closeModal();
    loadData();
  };

  // ... (Rest of functions: handleSaveAdmin, handleDeleteClient, etc. remain unchanged) ...
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFormData.name || !adminFormData.email || !adminFormData.password) {
        alert("All fields are required.");
        return;
    }
    if (adminFormData.password !== adminFormData.confirmPassword) {
        alert("Passwords do not match.");
        return;
    }
    try {
        await DataService.addAdmin(adminFormData.name, adminFormData.email, adminFormData.password);
        setIsAdminModalOpen(false);
        setAdminFormData({ name: '', email: '', password: '', confirmPassword: '' });
        loadData();
    } catch (e) {
        alert("Failed to create admin account.");
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this client? This action cannot be undone.")) {
        await DataService.deleteClient(id);
        loadData();
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this administrator?")) {
        try {
            await DataService.deleteAdmin(id);
            loadData();
        } catch (e: any) {
            alert(e.message || "Could not delete admin");
        }
    }
  };

  const handleEditClient = (client: Client) => {
      setEditingClient(client);
      const plan = PLANS.find(p => p.minutes === client.minuteLimit);
      if (plan) {
          setSelectedPlan(plan.name);
          setCustomLimit('');
      } else {
          setSelectedPlan('CUSTOM');
          setCustomLimit(client.minuteLimit.toString());
      }

      // SAFE INITIALIZATION
      setFormData({
        clientName: client.name,
        minuteLimit: client.minuteLimit,
        vapiApiKey: client.vapiApiKey || '',
        vapiPublicKey: client.vapiPublicKey || '',
        webhookUrl: client.webhookUrl || '',
        language: client.language || 'English',
        twoFactor: false, 
        memberName: '', 
        memberLoginId: client.memberLoginId || '',
        memberEmail: client.email,
        memberPassword: '', 
        confirmPassword: ''
      });
      
      setIsModalOpen(true);
      setCurrentStep(1);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
    setCurrentStep(1);
    setSelectedPlan('CONNECT');
    setCustomLimit('');
    setFormData({
      clientName: '',
      minuteLimit: 2000,
      vapiApiKey: '',
      vapiPublicKey: '',
      webhookUrl: '',
      language: 'English',
      twoFactor: false,
      memberName: '',
      memberLoginId: '',
      memberEmail: '',
      memberPassword: '',
      confirmPassword: ''
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Management Panel</h1>
          <p className="text-slate-500">Manage clients, billing, administrators, and system access.</p>
        </div>
        
        {activeTab === 'clients' ? (
            <button onClick={() => { setIsModalOpen(true); setCurrentStep(1); setEditingClient(null); }} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition shadow-sm"><Plus size={18} /> Add Client</button>
        ) : activeTab === 'admins' ? (
            <button onClick={() => setIsAdminModalOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition shadow-sm"><Plus size={18} /> Add Administrator</button>
        ) : null}
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6">
         <button onClick={() => setActiveTab('clients')} className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'clients' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Client Accounts</button>
         <button onClick={() => setActiveTab('billing')} className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'billing' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Billing & Reports</button>
         <button onClick={() => setActiveTab('admins')} className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'admins' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Administrators</button>
      </div>

      {/* ... Rest of the component (Tables, Modals) ... */}
      {/* The rest of the file structure (Pending Requests, Clients Table, Billing Table, Admin Table, Modals) remains identical to the previous version but uses the updated handleEditClient/handleSaveClient logic. */}
      {/* I will output the full content to ensure completeness */}
      
      {activeTab === 'clients' && pendingRequests.length > 0 && (
        <div className="mb-8 bg-orange-50 border border-orange-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="px-6 py-4 border-b border-orange-100 flex items-center gap-2"><Clock className="text-orange-600" size={20} /><h2 className="font-bold text-orange-900">Pending Top-Up Requests</h2><span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">{pendingRequests.length}</span></div>
          <div className="divide-y divide-orange-100">
            {pendingRequests.map(req => (
              <div key={req.id} className="px-6 py-4 flex items-center justify-between hover:bg-orange-50/50">
                 <div><p className="font-semibold text-slate-800">{req.clientName}</p><p className="text-sm text-slate-500">Requested <span className="font-bold text-slate-900">{req.amount.toLocaleString()} minutes</span></p><p className="text-xs text-slate-400 mt-1">{new Date(req.createdAt).toLocaleString()}</p></div>
                 <div className="flex gap-2"><button onClick={() => handleResolveRequest(req.id, false)} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded text-sm font-medium flex items-center gap-1 shadow-sm"><XCircle size={16} /> Reject</button><button onClick={() => handleResolveRequest(req.id, true)} className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded text-sm font-medium flex items-center gap-1 shadow-sm"><CheckCircle size={16} /> Approve</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex gap-4">
              <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search clients..." className="w-full pl-10 pr-4 py-2 bg-white rounded-md border border-slate-200 focus:border-brand-500 outline-none" /></div>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50"><tr><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Client Name</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Usage / Limit</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">API Config</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map(client => {
                  const percentage = (client.usedMinutes / client.minuteLimit) * 100;
                  return (
                    <tr key={client.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><img src={client.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-slate-200" /><div><p className="font-medium text-slate-900 flex items-center gap-2">{client.name}{client.webhookUrl && <span className="p-0.5 bg-blue-100 text-blue-600 rounded-full" title="Webhook Active"><Link2 size={12} /></span>}</p><p className="text-xs text-slate-500">{client.email}</p></div></div></td>
                      <td className="px-6 py-4"><div className="w-32"><div className="flex justify-between text-xs mb-1"><span>{Math.round(client.usedMinutes)} used</span><span className="text-slate-400">{client.minuteLimit} limit</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${percentage > 80 ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }} /></div></div></td>
                      <td className="px-6 py-4"><div className="flex gap-2">{client.vapiApiKey ? <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">Active</span> : <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500">Missing Key</span>}</div></td>
                      <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => onImpersonate(client)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors" title="View Dashboard"><Eye size={18} /></button><button onClick={() => handleEditClient(client)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Edit Client"><Edit3 size={18} /></button><button onClick={() => handleDeleteClient(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Delete Client"><Trash2 size={18} /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50"><tr><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Client</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Plan</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Usage (Mins)</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Total Bill</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Last Payment</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map(client => {
                  const bill = calculateBill(client);
                  return (
                    <tr key={client.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{client.name}</td><td className="px-6 py-4 text-slate-600">{bill.planName}</td><td className="px-6 py-4"><span className={`font-medium ${client.usedMinutes > client.minuteLimit ? 'text-red-600' : 'text-slate-700'}`}>{Math.round(client.usedMinutes).toLocaleString()}</span><span className="text-slate-400 text-xs"> / {client.minuteLimit.toLocaleString()}</span></td><td className="px-6 py-4 font-bold text-slate-900">AUD {bill.total.toLocaleString('en-AU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${bill.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{bill.status}</span></td><td className="px-6 py-4 text-xs text-slate-600">{bill.lastPayment.date !== '-' ? <div><p>{bill.lastPayment.date}</p><p className="font-medium text-slate-800">{bill.lastPayment.amount}</p></div> : <span className="text-slate-400 italic">No history</span>}</td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => handleOpenBillingModal(client, 'view')} className="text-slate-400 hover:text-brand-600 hover:bg-brand-50 p-2 rounded-full transition-colors" title="View Invoice Details"><FileText size={18} /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
           </table>
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50"><tr><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Administrator Name</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Email / Login</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map(admin => (
                  <tr key={admin.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><img src={admin.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-slate-200" /><p className="font-medium text-slate-900">{admin.name}</p></div></td><td className="px-6 py-4 text-sm text-slate-600">{admin.email}</td><td className="px-6 py-4 text-right"><button onClick={() => handleDeleteAdmin(admin.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Delete Admin" disabled={admins.length <= 1}><Trash2 size={18} /></button></td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      )}

      {billingModalOpen && billingClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
              <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex justify-between items-center sticky top-0">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">{billingAction === 'view' ? <FileText size={24} className="text-brand-600" /> : <Send size={24} className="text-blue-600" />}{billingAction === 'view' ? 'Invoice Details' : 'Send Billing Report'}</h3>
                 <button onClick={() => setBillingModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <div className="p-8">
                 {billingAction === 'view' ? (
                    (() => {
                        const bill = calculateBill(billingClient);
                        const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        return (
                            <div className="space-y-8">
                                <div className="flex justify-between items-start border-b border-slate-100 pb-6"><div><p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Billed To</p><p className="font-bold text-slate-900 text-lg">{billingClient.name}</p><p className="text-sm text-slate-500">{billingClient.email}</p></div><div className="text-right"><p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Invoice Date</p><p className="font-medium text-slate-900">{currentDate}</p><span className={`px-2 py-1 rounded-full text-xs font-bold mt-2 inline-block ${bill.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{bill.status}</span></div></div>
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200"><table className="w-full text-sm"><thead><tr className="text-xs text-slate-500 border-b border-slate-200"><th className="text-left pb-2 font-semibold">Description</th><th className="text-right pb-2 font-semibold">Details</th><th className="text-right pb-2 font-semibold">Amount</th></tr></thead><tbody className="divide-y divide-slate-200"><tr><td className="py-3 text-slate-800">Base Subscription</td><td className="py-3 text-right text-slate-600">{bill.planName} ({bill.baseLimit.toLocaleString()} mins)</td><td className="py-3 text-right font-medium">AUD {bill.basePrice.toFixed(2)}</td></tr>{bill.topUpTotal > 0 && <tr><td className="py-3 text-slate-800">Top-Ups / Extras</td><td className="py-3 text-right text-slate-600">{bill.topUpMinutes.toLocaleString()} mins added</td><td className="py-3 text-right font-medium">AUD {bill.topUpTotal.toFixed(2)}</td></tr>}<tr><td className="py-3 text-slate-800">Usage</td><td className="py-3 text-right text-slate-600">{Math.round(bill.usage).toLocaleString()} mins used</td><td className="py-3 text-right text-slate-400">-</td></tr></tbody></table></div>
                                <div className="flex justify-between items-center pt-2"><span className="text-lg font-bold text-slate-800">Total Invoiced</span><span className="text-2xl font-extrabold text-brand-700">AUD {bill.total.toLocaleString('en-AU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                                <div><h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><FileClock size={16} className="text-slate-500" /> Transaction History</h4><div className="bg-white border border-slate-200 rounded-lg overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Description</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-right">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{bill.transactions.length > 0 ? (bill.transactions.map((t, idx) => (<tr key={idx} className="hover:bg-slate-50"><td className="px-4 py-2 text-slate-600">{t.date}</td><td className="px-4 py-2 text-slate-800">{t.description}</td><td className="px-4 py-2 text-slate-800 font-medium text-right">{t.amount}</td><td className="px-4 py-2 text-right"><span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-bold">{t.status}</span></td></tr>))) : (<tr><td colSpan={4} className="px-4 py-4 text-center text-slate-400 italic">No transactions found.</td></tr>)}</tbody></table></div></div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button onClick={() => setBillingModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition-colors">Close</button><button onClick={handleDownloadCSV} className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-colors"><Download size={18} /> Download CSV</button></div>
                            </div>
                        );
                    })()
                 ) : (
                    <form onSubmit={handleFinalizeSendReport} className="space-y-4"><div><label className="block text-xs font-semibold text-slate-600 mb-1">Send Report To</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="email" required className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none text-sm bg-white" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} /></div><p className="text-xs text-slate-400 mt-1">This will send a detailed usage report and invoice estimate.</p></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setBillingModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancel</button><button type="submit" disabled={isSending} className="px-6 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors disabled:opacity-70">{isSending ? 'Sending...' : <><Send size={16} /> Send Email</>}</button></div></form>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Admin/Client Modals remain here ... */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Shield size={20} className="text-slate-600" /> Add Administrator</h2><button onClick={() => setIsAdminModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button></div>
              <form onSubmit={handleSaveAdmin} className="space-y-4">
                 <div><label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label><input required className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={adminFormData.name} onChange={e => setAdminFormData({...adminFormData, name: e.target.value})} /></div>
                 <div><label className="block text-xs font-semibold text-slate-600 mb-1">Email / Login ID</label><input required className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={adminFormData.email} onChange={e => setAdminFormData({...adminFormData, email: e.target.value})} /></div>
                 <div><label className="block text-xs font-semibold text-slate-600 mb-1">Password</label><input required type="password" className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={adminFormData.password} onChange={e => setAdminFormData({...adminFormData, password: e.target.value})} /></div>
                 <div><label className="block text-xs font-semibold text-slate-600 mb-1">Confirm Password</label><input required type="password" className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={adminFormData.confirmPassword} onChange={e => setAdminFormData({...adminFormData, confirmPassword: e.target.value})} /></div>
                 <button type="submit" className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold mt-4">Create Account</button>
              </form>
           </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8 animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-xl font-bold text-slate-800">{editingClient ? 'Edit Client' : 'Register Client & Member'}</h2><p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mt-1">Step {currentStep} of 2: {currentStep === 1 ? 'Client Information' : 'Member Information'}</p></div>
                <div className="flex gap-1"><div className={`h-2 w-8 rounded-full transition-colors ${currentStep >= 1 ? 'bg-brand-500' : 'bg-slate-200'}`}></div><div className={`h-2 w-8 rounded-full transition-colors ${currentStep >= 2 ? 'bg-brand-500' : 'bg-slate-200'}`}></div></div>
              </div>
              
              <form onSubmit={handleSaveClient} className="space-y-6">
                {currentStep === 1 && (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div><label className="block text-xs font-semibold text-slate-600 mb-1">Company Name <span className="text-red-500">*</span></label><input required autoFocus className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} /></div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">Select Plan / Limit <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                         {PLANS.map(plan => (<button key={plan.name} type="button" onClick={() => setSelectedPlan(plan.name)} className={`p-2 rounded-lg border text-left transition-all ${selectedPlan === plan.name ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'}`}><div className="text-xs font-bold text-slate-700">{plan.name}</div><div className="text-xs text-slate-500">{plan.minutes.toLocaleString()} mins</div></button>))}
                         <button type="button" onClick={() => setSelectedPlan('CUSTOM')} className={`p-2 rounded-lg border text-left transition-all ${selectedPlan === 'CUSTOM' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'}`}><div className="flex items-center gap-1 text-xs font-bold text-slate-700"><Edit3 size={10}/> Custom</div><div className="text-xs text-slate-500">Manual input</div></button>
                      </div>
                      {selectedPlan === 'CUSTOM' && (<div className="animate-in fade-in slide-in-from-top-1"><input type="number" min="1" placeholder="Enter custom minute limit" className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={customLimit} onChange={e => setCustomLimit(e.target.value)} /></div>)}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Private API Key <span className="text-slate-400 font-normal">(Optional)</span></label><input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white font-mono" placeholder="sk-..." value={formData.vapiApiKey} onChange={e => setFormData({...formData, vapiApiKey: e.target.value})} /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">Webhook URL <span className="text-slate-400 font-normal">(Optional)</span></label><div className="relative"><Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="url" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white font-mono" placeholder="https://hooks.zapier.com/..." value={formData.webhookUrl} onChange={e => setFormData({...formData, webhookUrl: e.target.value})} /></div></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Public API Key <span className="text-slate-400 font-normal">(Optional)</span></label><input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white font-mono" placeholder="Public key for web calls..." value={formData.vapiPublicKey} onChange={e => setFormData({...formData, vapiPublicKey: e.target.value})} /></div>
                    </div>
                    <div><label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">Language <Info size={12} className="text-slate-400" /></label><select className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})}><option>English</option><option>Spanish</option><option>French</option></select></div>
                  </div>
                )}
                {currentStep === 2 && (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-brand-50 p-3 rounded-lg border border-brand-100 flex items-center gap-2 mb-2"><input type="checkbox" id="2fa" className="w-4 h-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500 bg-white" checked={formData.twoFactor} onChange={e => setFormData({...formData, twoFactor: e.target.checked})} /><label htmlFor="2fa" className="text-sm text-brand-900 flex items-center gap-2 font-medium cursor-pointer select-none"><Lock size={14} /> Enable Two-Factor Authentication (2FA)</label></div>
                    <div><label className="block text-xs font-semibold text-slate-600 mb-1">Member Name</label><input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={formData.memberName} onChange={e => setFormData({...formData, memberName: e.target.value})} /></div>
                    <div><label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">Member Login ID <span className="text-red-500">*</span></label><div className="flex gap-2"><input required autoFocus className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={formData.memberLoginId} onChange={e => setFormData({...formData, memberLoginId: e.target.value})} /><button type="button" onClick={generateAutoCredentials} className="p-2 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 text-slate-600 transition-colors" title="Regenerate Credentials"><RefreshCw size={16} /></button></div></div>
                    <div><label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">Member Email (optional)</label><input type="email" className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={formData.memberEmail} onChange={e => setFormData({...formData, memberEmail: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">{editingClient ? 'New Password (Optional)' : 'Member Password'} {!editingClient && <span className="text-red-500">*</span>}</label><div className="relative"><input required={!editingClient} type={showPassword ? "text" : "password"} className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm pr-8 bg-white" value={formData.memberPassword} onChange={e => setFormData({...formData, memberPassword: e.target.value})} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Confirm Password {!editingClient && <span className="text-red-500">*</span>}</label><input required={!!formData.memberPassword} type="password" className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} /></div>
                    </div>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-6 flex justify-between items-center">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-semibold text-sm transition-colors">Cancel</button>
                  <div className="flex gap-3">
                    {currentStep === 2 && (<button type="button" onClick={() => setCurrentStep(1)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors"><ArrowLeft size={16} /> Back</button>)}
                    {currentStep === 1 ? (<button type="button" onClick={handleNext} className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-sm shadow-sm flex items-center gap-2 transition-colors">Next Step <ArrowRight size={16} /></button>) : (<button type="submit" className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-sm shadow-sm flex items-center gap-2 transition-colors"><Save size={16} /> {editingClient ? 'Save Changes' : 'Create Client'}</button>)}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;