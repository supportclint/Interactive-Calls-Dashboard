export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
}

export interface Client {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  minuteLimit: number;
  usedMinutes: number;
  vapiApiKey?: string;
  vapiPublicKey?: string;
  webhookUrl?: string; // For external notifications (GHL/Zapier)
  createdAt: string;
  language?: string;
  memberLoginId?: string;
  password?: string;
  overagesEnabled?: boolean;
  transactions?: Transaction[];
  notifications?: Notification[];
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'Paid' | 'Pending' | 'Failed' | 'Approved';
}

export interface Notification {
  id: string;
  date: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'success';
  read: boolean;
  webhookSent?: boolean;
}

export interface SystemSettings {
  masterApiKey: string;
}

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  password?: string;
}

export enum CallStatus {
  COMPLETED = 'completed',
  ONGOING = 'ongoing',
  FAILED = 'failed',
}

export enum EndReason {
  CUSTOMER_ENDED = 'customer-ended-call',
  ASSISTANT_ENDED = 'assistant-ended-call',
  SILENCE_TIMEOUT = 'silence-timeout',
  ERROR = 'error',
}

export interface Call {
  id: string;
  clientId: string;
  status: CallStatus;
  startedAt: string;
  durationSeconds: number;
  endReason: EndReason;
  customerPhone: string;
  assistantId: string;
  recordingUrl?: string;
  transcript?: string;
  summary?: string;
  cost?: number;
}

export interface AIAnalysisResult {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyPoints: string[];
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface TopUpRequest {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  status: RequestStatus;
  createdAt: string;
}