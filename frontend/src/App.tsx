import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ConversationSidebar } from './components/ConversationSidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { EditableTitle } from './components/EditableTitle';
import { apiService } from './services/api';
import { Message, ConversationSummary, SSEEvent } from './types';

function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [shouldFocusInput, setShouldFocusInput] = useState(false);
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
      setCurrentConversationTitle(conversation.title || null);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const startNewChat = () => {
    setCurrentConversation(null);
    setCurrentConversationTitle(null);
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
                const conversationId = data.conversation_id;
                setCurrentConversation(conversationId);
                // Load the conversation to get the generated title
                setTimeout(async () => {
                  try {
                    const conversation = await apiService.getConversation(conversationId);
                    setCurrentConversationTitle(conversation.title || null);
                  } catch (error) {
                    console.error('Failed to load conversation title:', error);
                  }
                }, 100);
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

              // Focus input after AI response completes
              setShouldFocusInput(true);

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

  const renameConversation = async (conversationId: string, title: string) => {
    try {
      await apiService.renameConversation(conversationId, title);
      if (currentConversation === conversationId) {
        setCurrentConversationTitle(title);
      }
      loadConversations();
    } catch (error) {
      console.error('Failed to rename conversation:', error);
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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
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
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Chat-AI
            </h1>
            <div className="flex-1 flex justify-center">
              <EditableTitle
                title={currentConversationTitle}
                onSave={(newTitle) => currentConversation && renameConversation(currentConversation, newTitle)}
                placeholder={currentConversation ? "Untitled Conversation" : "New Chat"}
                className="text-lg font-medium text-gray-900 dark:text-gray-100"
                disabled={!currentConversation || isStreaming}
              />
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && !streamingMessage && (
              <div className="text-center text-gray-600 dark:text-gray-400 mt-20">
                <div className="mb-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-soft">
                    <span className="text-2xl text-white">🤖</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    Welcome to ChatAI-GCP
                  </h2>
                  <p className="text-lg max-w-md mx-auto">
                    Start a conversation with our AI assistant powered by Google Gemini.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-12">
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">💡 Ask Questions</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get answers to your questions on any topic
                    </p>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">✨ Generate Content</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Create stories, code, emails, and more
                    </p>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">🔍 Analyze Data</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get insights and explanations about complex topics
                    </p>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">🎯 Solve Problems</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get step-by-step solutions and guidance
                    </p>
                  </div>
                </div>
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
          shouldFocus={shouldFocusInput}
          onFocused={() => setShouldFocusInput(false)}
        />
      </div>
    </div>
  );
}

export default App;
