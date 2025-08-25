export interface Message {
  message_id?: string;
  role: 'user' | 'ai';
  content: string;
  created_at: string;
}

export interface Conversation {
  conversation_id: string;
  title?: string;
  messages: Message[];
  created_at: string;
  last_updated: string;
  starred: boolean;
}

export interface ConversationSummary {
  conversation_id: string;
  title?: string;
  created_at: string;
  last_updated: string;
  starred: boolean;
  message_count: number;
  preview?: string;
}

export interface ChatRequest {
  message: string;
  encrypted?: boolean;
}

export interface SSEEvent {
  type: 'conversation_start' | 'chunk' | 'done' | 'error';
  content?: string;
  conversation_id?: string;
  error?: string;
}