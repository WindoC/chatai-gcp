import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div
        className={`
          max-w-[75%] px-5 py-4 rounded-2xl shadow-soft transition-all duration-200
          ${isUser 
            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary-500/20' 
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
          }
          ${isStreaming ? 'animate-pulse' : ''}
        `}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-md"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={`${className} bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm`} {...props}>
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
                  return <div className="overflow-x-auto">{children}</div>;
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4">
                      {children}
                    </blockquote>
                  );
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                        {children}
                      </table>
                    </div>
                  );
                },
                thead({ children }) {
                  return <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>;
                },
                th({ children }) {
                  return (
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-800">
                      {children}
                    </td>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        
        {isStreaming && !isUser && (
          <div className="mt-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};