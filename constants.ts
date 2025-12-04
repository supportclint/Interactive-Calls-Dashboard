import { Client, Call, EndReason, CallStatus } from './types';

// Determine API Base URL
// In development (vite), the proxy handles /api -> localhost:3000
// In production (Render), the Node server serves /api directly on the same domain
let apiBase = '/api';

// Safe access to environment variables
try {
    // If VITE_API_URL is set (e.g. for a specific deployment), use it
    if (import.meta.env && (import.meta.env as any).VITE_API_URL) {
        apiBase = (import.meta.env as any).VITE_API_URL;
    }
} catch (e) {
    // Fallback if import.meta.env is not available
}

export const API_BASE_URL = apiBase;

export const PLANS = [
  { name: 'CONNECT', price: 697, minutes: 2000 },
  { name: 'ENGAGE 360', price: 1800, minutes: 7000 },
  { name: 'CORPORATE', price: 3300, minutes: 20000 },
];

export const GHL_PAYMENT_URL = 'https://link.your-ghl-funnel.com/payment';