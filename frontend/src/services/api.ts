import { Conversation, ConversationSummary, ChatRequest } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export class APIService {
  private static instance: APIService;
  
  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async handleAuthError(response: Response): Promise<void> {
    if (response.status === 401) {
      // Token might be expired, try to refresh
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshResponse.ok) {
            const { access_token } = await refreshResponse.json();
            localStorage.setItem('access_token', access_token);
            return; // Token refreshed successfully
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }
      
      // If refresh fails, clear tokens and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.reload();
    }
  }

  async getConversations(limit: number = 50, offset: number = 0): Promise<ConversationSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/conversations?limit=${limit}&offset=${offset}`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to fetch conversations');
    }
    
    const data = await response.json();
    return data.conversations;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to fetch conversation');
    }
    
    return response.json();
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to delete conversation');
    }
  }

  async starConversation(conversationId: string, starred: boolean): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/star`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ starred }),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to star conversation');
    }
  }

  async renameConversation(conversationId: string, title: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/title`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ title }),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to rename conversation');
    }
  }

  async bulkDeleteNonstarred(): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/nonstarred`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to bulk delete conversations');
    }
    
    const data = await response.json();
    return data.data.deleted_count;
  }

  async createChatStream(message: string, conversationId?: string): Promise<EventSource> {
    const url = conversationId 
      ? `${API_BASE_URL}/api/chat/${conversationId}`
      : `${API_BASE_URL}/api/chat/`;
    
    const chatRequest: ChatRequest = { message };
    
    // Send the POST request and get the streaming response
    const headers = {
      ...this.getAuthHeaders(),
      'Accept': 'text/event-stream'
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(chatRequest),
    });

    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Create a custom EventSource-like object from the fetch response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    // Create a custom EventSource implementation
    const eventTarget = new EventTarget();
    let readyState: number = EventSource.OPEN;
    
    const customEventSource = {
      ...eventTarget,
      get readyState() { return readyState; },
      close: () => {
        readyState = EventSource.CLOSED;
        reader?.cancel();
      },
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: (event: Event) => {
        const result = eventTarget.dispatchEvent(event);
        // Forward to event handler properties
        if (event.type === 'message' && customEventSource.onmessage) {
          customEventSource.onmessage(event as MessageEvent);
        } else if (event.type === 'error' && customEventSource.onerror) {
          customEventSource.onerror(event);
        } else if (event.type === 'open' && customEventSource.onopen) {
          customEventSource.onopen(event);
        }
        return result;
      },
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      onopen: null as ((event: Event) => void) | null,
      url: '',
      withCredentials: false,
      CONNECTING: EventSource.CONNECTING,
      OPEN: EventSource.OPEN,
      CLOSED: EventSource.CLOSED,
    };

    // Process the stream
    (async () => {
      try {
        if (!reader) throw new Error('No reader available');
        
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              const event = new MessageEvent('message', { data });
              customEventSource.dispatchEvent(event);
            }
          }
        }
        
        readyState = EventSource.CLOSED;
      } catch (error) {
        console.error('Stream reading error:', error);
        const errorEvent = new Event('error');
        customEventSource.dispatchEvent(errorEvent);
        readyState = EventSource.CLOSED;
      }
    })();

    return customEventSource as EventSource;
  }
}

export const apiService = APIService.getInstance();