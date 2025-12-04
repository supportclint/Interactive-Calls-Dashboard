import React, { useState, useEffect } from 'react';
import { Server, Database, Shield, Code, FileJson, Calculator, AlertTriangle, Key, Copy, PlusCircle, BookOpen, CheckCircle, ShoppingCart, Zap, CreditCard, Eye, EyeOff, Save, ToggleLeft, ToggleRight, AlertOctagon } from 'lucide-react';
import { DataService } from '../services/dataService';
import { SystemSettings } from '../types';

const ApiDocumentation: React.FC = () => {
  const baseUrl = window.location.origin;
  const [masterKey, setMasterKey] = useState('');
  
  // Live Keys
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  
  // Test Keys
  const [stripeTestSecretKey, setStripeTestSecretKey] = useState('');
  const [stripeTestWebhookSecret, setStripeTestWebhookSecret] = useState('');
  
  const [isStripeTestMode, setIsStripeTestMode] = useState(false);
  
  const [showKey, setShowKey] = useState(false);
  const [showStripeKeys, setShowStripeKeys] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingStripe, setIsSavingStripe] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
        const settings = await DataService.getSystemSettings();
        setMasterKey(settings.masterApiKey || '');
        setStripeSecretKey(settings.stripeSecretKey || '');
        setStripeWebhookSecret(settings.stripeWebhookSecret || '');
        setStripeTestSecretKey(settings.stripeTestSecretKey || '');
        setStripeTestWebhookSecret(settings.stripeTestWebhookSecret || '');
        setIsStripeTestMode(settings.isStripeTestMode || false);
    };
    loadSettings();
  }, []);

  const handleGenerateKey = async () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'sk_live_';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setMasterKey(key);
    setIsSaving(true);
    await DataService.updateSystemSettings({ 
        masterApiKey: key
    });
    setIsSaving(false);
  };

  const handleSaveStripeKeys = async () => {
      setIsSavingStripe(true);
      try {
          const success = await DataService.updateSystemSettings({
              stripeSecretKey,
              stripeWebhookSecret,
              stripeTestSecretKey,
              stripeTestWebhookSecret,
              isStripeTestMode
          });
          
          if (success) {
              alert("Stripe settings saved successfully!");
          } else {
              alert("Failed to save keys. Check server permissions.");
          }
      } catch (error) {
          console.error("Failed to save keys", error);
          alert("An error occurred while saving keys.");
      } finally {
          setIsSavingStripe(false);
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">System Configuration & API Docs</h1>
        <p className="text-slate-500">Manage API keys, payment gateways, and view integration guides.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* MASTER API KEY */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Key size={20} className="text-brand-600" /> Master API Key
            </h3>
            <p className="text-sm text-slate-600 mb-4">
                Used to authenticate requests from external tools (GHL, Make, Zapier).
            </p>
            
            <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex-1 font-mono text-sm text-slate-800 break-all">
                    {masterKey ? (showKey ? masterKey : '•'.repeat(masterKey.length)) : <span className="text-slate-400 italic">No key generated yet</span>}
                </div>
                <button onClick={() => setShowKey(!showKey)} className="text-sm text-brand-600 font-medium hover:underline">
                    {showKey ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => navigator.clipboard.writeText(masterKey)} className="text-slate-400 hover:text-slate-600">
                    <Copy size={18} />
                </button>
            </div>
            
            <div className="mt-4">
                <button 
                    onClick={handleGenerateKey}
                    disabled={isSaving}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                    {isSaving ? 'Saving...' : (masterKey ? 'Regenerate Key' : 'Generate Key')}
                </button>
            </div>
        </div>

        {/* STRIPE CONFIGURATION */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard size={20} className="text-purple-600" /> Payment Gateway (Stripe)
                </h3>
                <button 
                    onClick={() => setIsStripeTestMode(!isStripeTestMode)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-colors ${isStripeTestMode ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}
                >
                    {isStripeTestMode ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    {isStripeTestMode ? 'TEST MODE' : 'LIVE MODE'}
                </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-4">
                Configure Stripe keys. Enable Test Mode to simulate payments using test cards.
            </p>

            <div className="space-y-4">
                {/* LIVE KEYS */}
                <div className={`p-3 rounded-lg border ${!isStripeTestMode ? 'border-green-200 bg-green-50/50' : 'border-slate-100 opacity-50'}`}>
                    <p className="text-xs font-bold text-green-800 mb-2 uppercase">Live Environment</p>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Live Secret Key</label>
                            <input 
                                type={showStripeKeys ? "text" : "password"}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm font-mono bg-white"
                                value={stripeSecretKey}
                                onChange={(e) => setStripeSecretKey(e.target.value)}
                                placeholder="sk_live_..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Live Webhook Secret</label>
                            <input 
                                type={showStripeKeys ? "text" : "password"}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm font-mono bg-white"
                                value={stripeWebhookSecret}
                                onChange={(e) => setStripeWebhookSecret(e.target.value)}
                                placeholder="whsec_..."
                            />
                        </div>
                    </div>
                </div>

                {/* TEST KEYS */}
                <div className={`p-3 rounded-lg border ${isStripeTestMode ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 opacity-50'}`}>
                    <p className="text-xs font-bold text-amber-800 mb-2 uppercase">Test Environment</p>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Test Secret Key</label>
                            <input 
                                type={showStripeKeys ? "text" : "password"}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm font-mono bg-white"
                                value={stripeTestSecretKey}
                                onChange={(e) => setStripeTestSecretKey(e.target.value)}
                                placeholder="sk_test_..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Test Webhook Secret</label>
                            <input 
                                type={showStripeKeys ? "text" : "password"}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm font-mono bg-white"
                                value={stripeTestWebhookSecret}
                                onChange={(e) => setStripeTestWebhookSecret(e.target.value)}
                                placeholder="whsec_..."
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <button 
                        type="button"
                        onClick={() => setShowStripeKeys(!showStripeKeys)}
                        className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-xs font-medium"
                    >
                        {showStripeKeys ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showStripeKeys ? 'Hide Keys' : 'Show Keys'}
                    </button>

                    <button 
                        onClick={handleSaveStripeKeys}
                        disabled={isSavingStripe}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                        {isSavingStripe ? 'Saving...' : <><Save size={16} /> Save Settings</>}
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* API ENDPOINTS REFERENCE */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* NEW: Get Client Errors */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertOctagon size={18} className="text-red-600" /> Get Client Call Errors
            </h3>
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold font-mono">GET</span>
                    <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded break-all">
                        {baseUrl}/client_errors.php
                    </code>
                </div>
                
                <p className="text-sm text-slate-600">
                    Retrieves a list of calls classified as "System Error" (e.g., Vapi internal errors, pipeline failures). 
                    Useful for monitoring and quality assurance.
                </p>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Headers & Params</h4>
                    <ul className="text-sm space-y-2 text-slate-700 font-mono text-xs">
                        <li>Header: x-api-key: [MASTER_KEY]</li>
                        <li>Query: email=[CLIENT_EMAIL]</li>
                        <li>Query: limit=100 (Optional, max 1000)</li>
                    </ul>
                </div>
                
                <div className="bg-slate-900 p-4 rounded-lg overflow-x-auto">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Response Example</h4>
<pre className="text-xs font-mono text-green-400">
{`{
  "status": "success",
  "error_count": 3,
  "errors": [
    {
      "call_id": "call_abc123",
      "started_at": "2025-12-01T10:00:00Z",
      "ended_reason": "pipeline-error-vapi-500",
      "recording_url": "..."
    }
  ]
}`}
</pre>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* External API Endpoint: Check Status */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4">Get Client Status</h3>
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold font-mono">GET</span>
                        <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded break-all">
                            {baseUrl}/client_status.php
                        </code>
                    </div>
                    <p className="text-sm text-slate-600">Fetch usage stats for workflows (e.g. 80% usage trigger).</p>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Headers & Params</h4>
                        <ul className="text-sm space-y-2 text-slate-700 font-mono text-xs">
                            <li>Header: x-api-key: [MASTER_KEY]</li>
                            <li>Query: email=[CLIENT_EMAIL]</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* External API Endpoint: Create Client */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <PlusCircle size={18} className="text-green-600" /> Create Client
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold font-mono">POST</span>
                        <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded break-all">
                            {baseUrl}/create_client.php
                        </code>
                    </div>
                    <p className="text-sm text-slate-600">Programmatically create new clients.</p>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Required JSON Body</h4>
                        <pre className="text-xs font-mono text-slate-700 overflow-x-auto">
{`{
  "name": "Client Ltd",
  "email": "contact@client.com",
  "minute_limit": 2000
}`}
                        </pre>
                    </div>
                </div>
            </div>
        </div>

      </div>

    </div>
  );
};

export default ApiDocumentation;