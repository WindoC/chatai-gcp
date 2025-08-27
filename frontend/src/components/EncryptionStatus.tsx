import React from 'react';
import { encryptionService } from '../services/encryption';

interface EncryptionStatusProps {
  onClick?: () => void;
  className?: string;
}

const EncryptionStatus: React.FC<EncryptionStatusProps> = ({ onClick, className = '' }) => {
  const isEnabled = encryptionService.isEncryptionEnabled();

  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
        isEnabled
          ? 'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-200'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
      } ${className}`}
      title={isEnabled ? 'End-to-end encryption is enabled' : 'Click to enable end-to-end encryption'}
    >
      {isEnabled ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="text-sm font-medium">Encrypted</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm">Enable Encryption</span>
        </>
      )}
    </button>
  );
};

export default EncryptionStatus;