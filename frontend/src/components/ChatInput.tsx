import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string, enableSearch?: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  shouldFocus?: boolean;
  onFocused?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type your message...",
  shouldFocus = false,
  onFocused
}) => {
  const [message, setMessage] = useState('');
  const [enableSearch, setEnableSearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), enableSearch);
      setMessage('');
      setEnableSearch(false); // Auto-reset after sending
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    if (shouldFocus && !disabled && textareaRef.current) {
      textareaRef.current.focus();
      onFocused?.();
    }
  }, [shouldFocus, disabled, onFocused]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 transition-colors duration-200">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        {/* Search Toggle */}
        <div className="mb-4 flex items-center">
          <label className="flex items-center space-x-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={enableSearch}
                onChange={(e) => setEnableSearch(e.target.checked)}
                disabled={disabled}
                className="
                  w-5 h-5 text-primary-500 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600
                  rounded focus:ring-2 focus:ring-primary-500 focus:ring-offset-0
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                "
              />
              {enableSearch && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <svg className="w-3 h-3 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Search the web for current information
              </span>
            </div>
          </label>
        </div>
        
        <div className="flex items-end space-x-4">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="
                w-full px-4 py-4 pr-32 border border-gray-300 dark:border-gray-600 rounded-2xl
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                placeholder-gray-500 dark:placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
                resize-none overflow-hidden min-h-[56px] max-h-[200px] shadow-soft
                transition-all duration-200
              "
              style={{ minHeight: '56px' }}
            />
            <div className="absolute right-4 bottom-4 text-xs text-gray-500 dark:text-gray-400">
              {disabled ? 'Sending...' : 'Enter to send, Shift+Enter for new line'}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className="
              px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-medium
              hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500
              disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed
              transition-all duration-200 shadow-soft hover:shadow-soft-lg
              min-h-[56px] flex items-center justify-center
            "
          >
            {disabled ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};