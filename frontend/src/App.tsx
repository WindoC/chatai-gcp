import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ConversationSidebar } from './components/ConversationSidebar';
import { apiService } from './services/api';
import { Message, ConversationSummary, SSEEvent } from './types';

function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, streamingMessage]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const convs = await apiService.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const conversation = await apiService.getConversation(conversationId);
      setMessages(conversation.messages);
      setCurrentConversation(conversationId);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const startNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
    setStreamingMessage('');
  };

  const sendMessage = async (messageText: string) => {
    if (isStreaming) return;

    // Add user message to UI immediately
    const userMessage: Message = {
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingMessage('');

    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Create chat stream
      const eventSource = await apiService.createChatStream(messageText, currentConversation || undefined);
      eventSourceRef.current = eventSource;

      let aiMessageContent = '';
      let finalConversationId = currentConversation;

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);

          switch (data.type) {
            case 'conversation_start':
              // New conversation started
              break;

            case 'chunk':
              if (data.content) {
                aiMessageContent += data.content;
                setStreamingMessage(aiMessageContent);
              }
              break;

            case 'done':
              if (data.conversation_id) {
                finalConversationId = data.conversation_id;
                setCurrentConversation(data.conversation_id);
              }

              // Add final AI message
              const aiMessage: Message = {
                role: 'ai',
                content: aiMessageContent,
                created_at: new Date().toISOString(),
              };

              setMessages(prev => [...prev, aiMessage]);
              setStreamingMessage('');
              setIsStreaming(false);
              eventSource.close();

              // Reload conversations to update sidebar
              loadConversations();
              break;

            case 'error':
              console.error('SSE Error:', data.error);
              setIsStreaming(false);
              setStreamingMessage('');
              eventSource.close();
              break;
          }
        } catch (error) {
          console.error('Failed to parse SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsStreaming(false);
        setStreamingMessage('');
        eventSource.close();
      };

    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await apiService.deleteConversation(conversationId);
      if (currentConversation === conversationId) {
        startNewChat();
      }
      loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const starConversation = async (conversationId: string, starred: boolean) => {
    try {
      await apiService.starConversation(conversationId, starred);
      loadConversations();
    } catch (error) {
      console.error('Failed to star conversation:', error);
    }
  };

  const bulkDeleteNonstarred = async () => {
    try {
      await apiService.bulkDeleteNonstarred();
      if (currentConversation) {
        const currentConv = conversations.find(c => c.conversation_id === currentConversation);
        if (currentConv && !currentConv.starred) {
          startNewChat();
        }
      }
      loadConversations();
    } catch (error) {
      console.error('Failed to bulk delete conversations:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentConversationId={currentConversation || undefined}
        onSelectConversation={loadConversation}
        onNewChat={startNewChat}
        onDeleteConversation={deleteConversation}
        onStarConversation={starConversation}
        onBulkDeleteNonstarred={bulkDeleteNonstarred}
        loading={isLoading}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col md:ml-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">ChatAI-GCP</h1>
            <div className="text-sm text-gray-500">
              {currentConversation ? 'Conversation' : 'New Chat'}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && !streamingMessage && (
              <div className="text-center text-gray-500 mt-20">
                <h2 className="text-2xl font-semibold mb-4">Welcome to ChatAI-GCP</h2>
                <p>Start a conversation with our AI assistant powered by Google Gemini.</p>
              </div>
            )}

            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}

            {streamingMessage && (
              <ChatMessage
                message={{
                  role: 'ai',
                  content: streamingMessage,
                  created_at: new Date().toISOString(),
                }}
                isStreaming={true}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <ChatInput
          onSendMessage={sendMessage}
          disabled={isStreaming}
          placeholder={isStreaming ? "AI is responding..." : "Type your message..."}
        />
      </div>
    </div>
  );
}

export default App;
