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

export interface EncryptedContent {
  content: string;
  encrypted: boolean;
  key_hash: string;
}

export interface ChatRequest {
  message: string | EncryptedContent;
  encrypted?: boolean;
  key_hash?: string;
}

export interface SSEEvent {
  type: 'conversation_start' | 'chunk' | 'done' | 'error';
  content?: string;
  conversation_id?: string;
  error?: string;
  encrypted?: boolean;
  key_hash?: string;
}