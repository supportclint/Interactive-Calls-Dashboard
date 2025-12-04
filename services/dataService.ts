import { Client, Call, TopUpRequest, RequestStatus, AdminProfile, UserRole, SystemSettings, Notification } from '../types';
import { VapiService } from './vapiService';
import { API_BASE_URL } from '../constants';

// DATABASE INTERFACE
interface CallCacheEntry {
  lastSync: string;
  calls: Call[];
}

interface DatabaseSchema {
  clients: Client[];
  requests: TopUpRequest[];
  admins: AdminProfile[]; 
  adminProfile?: AdminProfile;
  systemSettings?: SystemSettings;
  callCache?: Record<string, CallCacheEntry>; 
}

// Initial Data
const INITIAL_DB: DatabaseSchema = {
  clients: [],
  requests: [],
  admins: [
    {
      id: 'admin_main',
      name: 'System Admin',
      email: 'admin@interactivecalls.com.au',
      avatarUrl: 'https://ui-avatars.com/api/?name=System+Admin&background=0f172a&color=fff',
      password: 'admin' 
    },
    {
      id: 'admin_mark',
      name: 'Mark Clint',
      email: 'markclint@lsu.edu',
      avatarUrl: 'https://ui-avatars.com/api/?name=Mark+Clint&background=0f172a&color=fff',
      password: 'qwerty12345' 
    },
    {
      id: 'admin_taps',
      name: 'Tapiwa',
      email: 'tapiwa@interactivecue.com',
      avatarUrl: 'https://ui-avatars.com/api/?name=Tapiwa&background=0f172a&color=fff',
      password: 'tapiwa12345' 
    }
  ],
  systemSettings: {
    masterApiKey: ''
  },
  callCache: {}
};

let dbCache: DatabaseSchema = { ...INITIAL_DB };
let isInitialized = false;

const STORAGE_KEY_SESSION = 'interactive_calls_session';

const loadSession = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SESSION);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const getBillingCycleStart = (createdAtStr: string): Date => {
  const created = new Date(createdAtStr);
  const now = new Date();
  let cycleStart = new Date(now.getFullYear(), now.getMonth(), created.getDate());
  if (now < cycleStart) {
    cycleStart.setMonth(cycleStart.getMonth() - 1);
  }
  cycleStart.setHours(0, 0, 0, 0);
  return cycleStart;
};

export const DataService = {
  
  // --- SYNC WITH BACKEND ---
  init: async () => {
    if (isInitialized) return;
    try {
      await DataService.sync(); // Fetch initial data
    } catch (e) {
      console.warn("Could not connect to API. Fallback to defaults.");
    }
    isInitialized = true;
  },

  // Sync latest data from server and trigger any pending webhooks
  sync: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/db`);
      if (response.ok) {
        const data = await response.json();
        
        // Migrations
        if (data.adminProfile && (!data.admins || data.admins.length === 0)) {
           data.admins = [data.adminProfile];
           delete data.adminProfile;
           await fetch(`${API_BASE_URL}/db`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(data)
           });
        }

        if (data && (data.clients || data.admins)) {
          // Merge strategy: Server is source of truth.
          const serverCallCache = data.callCache || {};
          const localCallCache = dbCache.callCache || {};
          
          dbCache = { ...INITIAL_DB, ...data };
          if (!dbCache.admins) dbCache.admins = INITIAL_DB.admins;
          if (!dbCache.systemSettings) dbCache.systemSettings = { masterApiKey: '' };
          
          // Use server cache as base
          dbCache.callCache = { ...serverCallCache, ...localCallCache };

          // Process webhooks
          await DataService.processPendingWebhooks();
        }
      }
    } catch (e) {
      console.error("Sync failed", e);
    }
  },

  save: async () => {
    try {
      // 1. Save Full DB to Server
      await fetch(`${API_BASE_URL}/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbCache)
      });
      
      // 2. Save Lightweight Backup to LocalStorage (No Call Cache)
      const backupData = { ...dbCache };
      delete backupData.callCache; 
      
      try {
          localStorage.setItem('local_db_backup', JSON.stringify(backupData));
      } catch (storageErr) {
          console.warn("LocalStorage full, skipping backup save.", storageErr);
      }
      
    } catch (e) {
      console.error("Failed to save to server", e);
    }
  },

  // --- NOTIFICATION & WEBHOOK SYSTEM ---
  processPendingWebhooks: async () => {
    let hasChanges = false;
    
    for (const client of dbCache.clients) {
      if (client.webhookUrl && client.notifications) {
        for (const note of client.notifications) {
          if (!note.webhookSent) {
            try {
              console.log(`[Webhook] Processing pending notification: ${note.title}`);
              
              const response = await fetch(client.webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      event: 'notification',
                      notification_type: note.type,
                      client_id: client.id,
                      client_name: client.name,
                      id: note.id,
                      timestamp: note.date,
                      title: note.title,
                      message: note.message,
                      read: note.read
                  })
              });

              if (response.ok) {
                  note.webhookSent = true;
                  hasChanges = true;
                  console.log(`[Webhook] Successfully sent: ${note.title}`);
              } else {
                  console.warn(`[Webhook] Server responded with status ${response.status}`);
              }

            } catch (e) {
              console.warn("[Webhook] Error processing pending webhook (Network Error)", e);
            }
          }
        }
      }
    }

    if (hasChanges) {
      await DataService.save();
    }
  },

  addNotification: async (clientId: string, notification: { title: string, message: string, type: 'warning' | 'info' | 'success' }): Promise<void> => {
    await DataService.init();
    const client = dbCache.clients.find(c => c.id === clientId);
    if (!client) return;

    if (!client.notifications) client.notifications = [];

    const newNotification: Notification = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      date: new Date().toISOString(),
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: false,
      webhookSent: false
    };

    client.notifications.unshift(newNotification);
    if (client.notifications.length > 50) {
        client.notifications = client.notifications.slice(0, 50);
    }
    
    await DataService.save();

    // WEBHOOK TRIGGER (Immediate Attempt)
    if (client.webhookUrl) {
      try {
        console.log(`[Webhook] Sending notification to ${client.webhookUrl}`);
        const response = await fetch(client.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'notification',
                notification_type: newNotification.type,
                client_id: client.id,
                client_name: client.name,
                id: newNotification.id,
                timestamp: newNotification.date,
                title: newNotification.title,
                message: newNotification.message,
                read: newNotification.read
            })
        });

        if (response.ok) {
            newNotification.webhookSent = true;
            await DataService.save(); 
            console.log(`[Webhook] Immediate delivery success.`);
        }
      } catch (e) {
        console.warn("[Webhook] Immediate delivery failed. Queued for retry.", e);
      }
    }
  },

  // --- AUTHENTICATION ---
  login: async (loginId: string, password: string): Promise<{ role: UserRole, user: Client | AdminProfile } | null> => {
    await DataService.init();

    const admin = dbCache.admins.find(a => 
        (a.email === loginId || loginId === 'admin' || a.email.split('@')[0] === loginId) && 
        a.password === password
    );

    if (admin) {
      const session = { role: UserRole.ADMIN, user: admin };
      DataService.saveSession(session);
      return session;
    }

    const client = dbCache.clients.find(c => c.memberLoginId === loginId && c.password === password);
    if (client) {
      const session = { role: UserRole.CLIENT, user: client };
      DataService.saveSession(session);
      return session;
    }

    return null;
  },

  saveSession: (session: { role: UserRole, user: Client | AdminProfile }) => {
    try {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    } catch (e) { console.error("Session save failed", e); }
  },

  getSession: (): { role: UserRole, user: Client | AdminProfile } | null => {
    return loadSession();
  },

  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY_SESSION);
  },

  // --- SYSTEM SETTINGS ---
  getSystemSettings: async (): Promise<SystemSettings> => {
    await DataService.init();
    return dbCache.systemSettings || { masterApiKey: '' };
  },

  updateSystemSettings: async (settings: SystemSettings): Promise<void> => {
    await DataService.init();
    dbCache.systemSettings = settings;
    await DataService.save();
  },

  // --- CLIENTS ---
  getClients: async (): Promise<Client[]> => {
    await DataService.init();
    return dbCache.clients;
  },

  getClientById: async (id: string): Promise<Client | undefined> => {
    await DataService.init();
    return dbCache.clients.find(c => c.id === id);
  },

  updateClient: async (updatedClient: Client): Promise<Client> => {
    await DataService.init();
    dbCache.clients = dbCache.clients.map(c => c.id === updatedClient.id ? updatedClient : c);
    await DataService.save();
    return updatedClient;
  },

  addClient: async (newClientData: any): Promise<Client> => {
    await DataService.init();
    const newClient: Client = {
      ...newClientData,
      id: `c${Date.now()}`,
      createdAt: new Date().toISOString(),
      usedMinutes: 0,
      overagesEnabled: false,
      password: newClientData.memberPassword,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(newClientData.name)}&background=random`
    };
    dbCache.clients = [...dbCache.clients, newClient];
    await DataService.save();
    return newClient;
  },

  deleteClient: async (id: string): Promise<void> => {
    await DataService.init();
    dbCache.clients = dbCache.clients.filter(c => c.id !== id);
    if (dbCache.callCache && dbCache.callCache[id]) {
        delete dbCache.callCache[id];
    }
    await DataService.save();
  },

  toggleClientOverages: async (clientId: string, enabled: boolean): Promise<Client> => {
    await DataService.init();
    const clientIndex = dbCache.clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) throw new Error("Client not found");

    const updatedClient = { ...dbCache.clients[clientIndex], overagesEnabled: enabled };
    dbCache.clients[clientIndex] = updatedClient;
    await DataService.save();

    const action = enabled ? "Enabled" : "Disabled";
    await DataService.addNotification(clientId, {
        title: `Overages ${action}`,
        message: `Overages have been ${action.toLowerCase()} for your account.`,
        type: 'info'
    });

    return updatedClient;
  },

  // --- ADMIN MANAGEMENT ---
  getAdmins: async (): Promise<AdminProfile[]> => {
    await DataService.init();
    return dbCache.admins;
  },

  getAdminById: async (id: string): Promise<AdminProfile | undefined> => {
    await DataService.init();
    return dbCache.admins.find(a => a.id === id);
  },

  addAdmin: async (name: string, email: string, password: string): Promise<AdminProfile> => {
    await DataService.init();
    const newAdmin: AdminProfile = {
        id: `admin_${Date.now()}`,
        name,
        email,
        password,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=fff`
    };
    dbCache.admins.push(newAdmin);
    await DataService.save();
    return newAdmin;
  },

  deleteAdmin: async (id: string): Promise<void> => {
    await DataService.init();
    if (dbCache.admins.length <= 1) {
        throw new Error("Cannot delete the last administrator.");
    }
    dbCache.admins = dbCache.admins.filter(a => a.id !== id);
    await DataService.save();
  },

  updateAdmin: async (updatedAdmin: AdminProfile): Promise<AdminProfile> => {
    await DataService.init();
    dbCache.admins = dbCache.admins.map(a => a.id === updatedAdmin.id ? updatedAdmin : a);
    await DataService.save();
    return updatedAdmin;
  },

  getAdminProfile: async (): Promise<AdminProfile> => {
    await DataService.init();
    return dbCache.admins[0]; 
  },

  updateAdminProfile: async (updatedProfile: AdminProfile): Promise<AdminProfile> => {
    return DataService.updateAdmin(updatedProfile);
  },

  // --- REQUESTS ---
  createTopUpRequest: async (clientId: string, amount: number): Promise<TopUpRequest> => {
    await DataService.init();
    const client = dbCache.clients.find(c => c.id === clientId);
    if (!client) throw new Error("Client not found");

    const newRequest: TopUpRequest = {
      id: `req_${Date.now()}`,
      clientId,
      clientName: client.name,
      amount,
      status: RequestStatus.PENDING,
      createdAt: new Date().toISOString()
    };
    
    dbCache.requests = [newRequest, ...dbCache.requests];
    await DataService.save();
    return newRequest;
  },

  getPendingRequests: async (): Promise<TopUpRequest[]> => {
    await DataService.init();
    return dbCache.requests.filter(r => r.status === RequestStatus.PENDING);
  },

  getClientRequests: async (clientId: string): Promise<TopUpRequest[]> => {
    await DataService.init();
    return dbCache.requests.filter(r => r.clientId === clientId).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  resolveTopUpRequest: async (requestId: string, approved: boolean): Promise<TopUpRequest> => {
    await DataService.init();
    const index = dbCache.requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error("Request not found");

    const request = dbCache.requests[index];
    const newStatus = approved ? RequestStatus.APPROVED : RequestStatus.REJECTED;
    
    dbCache.requests[index] = { ...request, status: newStatus };

    if (approved) {
       const clientIndex = dbCache.clients.findIndex(c => c.id === request.clientId);
       if (clientIndex !== -1) {
          dbCache.clients[clientIndex].minuteLimit += request.amount;
       }
       await DataService.addNotification(request.clientId, {
           title: "Payment Verified",
           message: `Your top-up of ${request.amount} minutes has been approved.`,
           type: 'success'
       });
    } else {
       await DataService.addNotification(request.clientId, {
           title: "Request Rejected",
           message: `Your top-up request for ${request.amount} minutes was declined.`,
           type: 'warning'
       });
    }

    await DataService.save();
    return dbCache.requests[index];
  },

  sendBillingReport: async (clientId: string, targetEmail: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log(`Billing report sent to client ${clientId} at email: ${targetEmail}`);
    return true;
  },

  // --- CALLS (VAPI) ---
  
  getCallsByClientId: async (clientId: string, skipSave = false): Promise<Call[]> => {
    await DataService.init();
    
    const client = dbCache.clients.find(c => c.id === clientId);
    
    if (client && client.vapiApiKey && client.vapiApiKey.length > 5) {
        
        if (!dbCache.callCache) dbCache.callCache = {};
        if (!dbCache.callCache[clientId]) {
            dbCache.callCache[clientId] = { lastSync: new Date(0).toISOString(), calls: [] };
        }
        
        const cacheEntry = dbCache.callCache[clientId];
        
        let fetchStartDate: Date;
        if (cacheEntry.calls.length > 0) {
            const lastSync = new Date(cacheEntry.lastSync);
            fetchStartDate = new Date(lastSync.getTime() - (60 * 60 * 1000));
        } else {
            fetchStartDate = new Date('2025-01-01');
        }

        try {
            const newCalls = await VapiService.getCalls(client.vapiApiKey, 5000, fetchStartDate);
            
            const callMap = new Map<string, Call>();
            cacheEntry.calls.forEach(c => callMap.set(c.id, c));
            newCalls.forEach(c => {
                c.clientId = client.id;
                callMap.set(c.id, c);
            });

            const mergedCalls = Array.from(callMap.values())
                .sort((a,b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
            
            if (newCalls.length > 0) {
                dbCache.callCache[clientId] = {
                    lastSync: new Date().toISOString(),
                    calls: mergedCalls
                };
                
                // Update Usage
                const cycleStart = getBillingCycleStart(client.createdAt);
                const currentCycleCalls = mergedCalls.filter(call => {
                   return new Date(call.startedAt).getTime() >= cycleStart.getTime();
                });
                
                const totalMinutes = currentCycleCalls.reduce((acc, call) => acc + ((call.durationSeconds || 0) / 60), 0);
                const roundedMinutes = Math.round(totalMinutes * 100) / 100;
                
                if (Math.abs(client.usedMinutes - roundedMinutes) > 0.01) {
                    client.usedMinutes = roundedMinutes;
                }

                // WARNING CHECK
                const usagePercent = (client.usedMinutes / client.minuteLimit) * 100;
                if (!client.overagesEnabled && usagePercent >= 80) {
                     const hasRecentWarning = client.notifications?.some(n => 
                        n.title === 'Critical Usage Warning' && 
                        new Date(n.date).getTime() > Date.now() - (24 * 60 * 60 * 1000)
                     );
                     
                     if (!hasRecentWarning) {
                         await DataService.addNotification(client.id, {
                             title: 'Critical Usage Warning',
                             message: `You have used ${Math.round(usagePercent)}% of your monthly minute limit. Please top up.`,
                             type: 'warning'
                         });
                     }
                }

                if (!skipSave) {
                   await DataService.save();
                }
            }

            return mergedCalls;

        } catch (e) {
            console.error("Error fetching live Vapi data, returning cached", e);
            return cacheEntry.calls;
        }
    }
    return [];
  },

  getAllCalls: async (startDate?: Date): Promise<Call[]> => {
    await DataService.init();
    
    const fetchPromises = dbCache.clients.map(async (client) => {
       return await DataService.getCallsByClientId(client.id, true);
    });

    const results = await Promise.all(fetchPromises);
    
    await DataService.save();

    const allCalls = results.flat();

    if (startDate) {
        return allCalls.filter(c => new Date(c.startedAt).getTime() >= startDate.getTime())
                       .sort((a,b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }

    return allCalls.sort((a,b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  },

  getClientStats: async (clientId: string) => {
    await DataService.init();
    
    const client = await DataService.getClientById(clientId);
    if (!client) return { totalMinutes: 0, totalCalls: 0, reasonCounts: {} };

    const clientCalls = await DataService.getCallsByClientId(clientId);
    
    const cycleStart = getBillingCycleStart(client.createdAt);
    const currentCycleCalls = clientCalls.filter(call => {
       return new Date(call.startedAt).getTime() >= cycleStart.getTime();
    });

    const totalMinutes = currentCycleCalls.reduce((acc, call) => acc + (call.durationSeconds / 60), 0);
    const totalCalls = currentCycleCalls.length;
    
    const reasonCounts = currentCycleCalls.reduce((acc, call) => {
      acc[call.endReason] = (acc[call.endReason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMinutes: Math.round(totalMinutes * 100) / 100,
      totalCalls,
      reasonCounts
    };
  }
};