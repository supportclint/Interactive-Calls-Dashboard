import { Call, CallStatus, EndReason } from '../types';
import { API_BASE_URL } from '../constants';

interface VapiCallResponse {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  customer?: {
    number: string;
  };
  assistantId?: string;
  recordingUrl?: string;
  transcript?: string;
  analysis?: {
    summary?: string;
    structuredData?: any;
  };
  durationSeconds?: number;
}

export const VapiService = {
  // Fetch calls in chunks. 
  getCalls: async (apiKey: string, totalLimit = 1000, startDate?: Date, isRetry = false): Promise<Call[]> => {
    const BATCH_SIZE = 500;
    let allCalls: Call[] = [];
    let nextCursor: string | null = null;
    let keepFetching = true;

    console.log(`[VapiService] Starting bulk fetch. Target: ${totalLimit}, StartDate: ${startDate?.toISOString()}`);

    try {
      while (keepFetching && allCalls.length < totalLimit) {
        // RATE LIMITING DELAY
        if (allCalls.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500)); 
        }

        const remaining = totalLimit - allCalls.length;
        const currentLimit = Math.min(remaining, BATCH_SIZE);

        const batchCalls = await VapiService.fetchBatch(apiKey, currentLimit, startDate, nextCursor);
        
        if (batchCalls.length === 0) {
          keepFetching = false;
        } else {
          allCalls = [...allCalls, ...batchCalls];
          
          const lastCall = batchCalls[batchCalls.length - 1];
          nextCursor = lastCall.startedAt;

          if (batchCalls.length < currentLimit) {
            keepFetching = false;
          }
        }
      }

      return allCalls;

    } catch (error: any) {
      if (error.message === 'RETENTION_ERROR' && !isRetry) {
          console.warn("[VapiService] Retention limit hit. Retrying with 14-day window...");
          const safeDate = new Date();
          safeDate.setDate(safeDate.getDate() - 14); 
          return VapiService.getCalls(apiKey, totalLimit, safeDate, true);
      }
      console.error('[VapiService] Critical Failure during bulk fetch:', error);
      return allCalls;
    }
  },

  // Internal helper to fetch a single batch via Node Backend Proxy
  fetchBatch: async (apiKey: string, limit: number, startDate?: Date, createdBefore?: string | null): Promise<Call[]> => {
    try {
      // Use the API_BASE_URL (which points to /api on Render/Localhost)
      const endpoint = `${API_BASE_URL}/vapi`;
      
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('_cb', Date.now().toString());

      if (startDate) {
          params.append('createdAtGt', startDate.toISOString());
      }

      if (createdBefore) {
          params.append('createdAtLt', createdBefore);
      }

      const uniqueUrl = `${endpoint}?${params.toString()}`;

      const response = await fetch(uniqueUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 400 && (errorText.includes('retention') || errorText.includes('subscription plan'))) {
            throw new Error('RETENTION_ERROR');
        }
        console.error(`[VapiService] Batch HTTP Error ${response.status}:`, errorText);
        return [];
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
          return [];
      }

      return data.map((vapiCall: any) => {
        let duration = vapiCall.durationSeconds || 0;
        if (!duration && vapiCall.startedAt && vapiCall.endedAt) {
          const start = new Date(vapiCall.startedAt).getTime();
          const end = new Date(vapiCall.endedAt).getTime();
          duration = (end - start) / 1000;
        }

        let status = CallStatus.COMPLETED;
        if (vapiCall.status === 'active' || vapiCall.status === 'in-progress') {
          status = CallStatus.ONGOING;
        } else if (vapiCall.status === 'failed') {
            status = CallStatus.FAILED;
        }

        let endReason = EndReason.ERROR;
        const reason = vapiCall.endedReason || '';
        if (reason.includes('customer')) endReason = EndReason.CUSTOMER_ENDED;
        else if (reason.includes('assistant') || reason.includes('bot')) endReason = EndReason.ASSISTANT_ENDED;
        else if (reason.includes('silence')) endReason = EndReason.SILENCE_TIMEOUT;

        const transcriptText = vapiCall.transcript || vapiCall.analysis?.summary || '';

        return {
          id: vapiCall.id,
          clientId: '',
          status: status,
          startedAt: vapiCall.startedAt,
          durationSeconds: duration,
          endReason: endReason,
          customerPhone: vapiCall.customer?.number || 'Unknown',
          assistantId: vapiCall.assistantId || 'Unknown',
          recordingUrl: vapiCall.recordingUrl,
          transcript: transcriptText,
          summary: vapiCall.analysis?.summary,
          cost: vapiCall.cost || 0
        };
      });

    } catch (error) {
      throw error; 
    }
  }
};