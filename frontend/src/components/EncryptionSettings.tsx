import React, { useState, useEffect } from 'react';
import { encryptionService, EncryptionError } from '../services/encryption';
import { validateEncryptionKey } from '../services/api';

interface EncryptionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onEncryptionEnabled?: () => void;
}

const EncryptionSettings: React.FC<EncryptionSettingsProps> = ({
  isOpen,
  onClose,
  onEncryptionEnabled
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsEncryptionEnabled(encryptionService.isEncryptionEnabled());
      setError('');
      setSuccess('');
      if (!encryptionService.isEncryptionEnabled()) {
        setPassphrase('');
        setConfirmPassphrase('');
      }
    }
  }, [isOpen]);

  const handleEnableEncryption = async () => {
    if (!passphrase) {
      setError('Please enter a passphrase');
      return;
    }

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters long');
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Initialize encryption with passphrase
      const { keyHash } = await encryptionService.initializeEncryption(passphrase);
      
      // Validate key with backend
      const validation = await validateEncryptionKey(keyHash);
      
      if (validation.success && validation.data.valid) {
        setSuccess('End-to-end encryption enabled successfully!');
        setIsEncryptionEnabled(true);
        setPassphrase('');
        setConfirmPassphrase('');
        
        // Notify parent component
        if (onEncryptionEnabled) {
          onEncryptionEnabled();
        }
        
        // Auto-close after success
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError('Invalid encryption key. Please check your passphrase.');
        encryptionService.clearEncryptionState();
      }
    } catch (error) {
      console.error('Failed to enable encryption:', error);
      if (error instanceof EncryptionError) {
        setError(error.message);
      } else {
        setError('Failed to enable encryption. Please try again.');
      }
      encryptionService.clearEncryptionState();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableEncryption = () => {
    encryptionService.clearEncryptionState();
    setIsEncryptionEnabled(false);
    setSuccess('Encryption disabled');
    setPassphrase('');
    setConfirmPassphrase('');
  };

  const handleTestDecryption = async () => {
    if (!isEncryptionEnabled) {
      setError('Encryption is not enabled');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Test encryption/decryption round trip
      const testMessage = 'This is a test message for encryption validation.';
      const encrypted = await encryptionService.encryptText(testMessage);
      const decrypted = await encryptionService.decryptText(encrypted);
      
      if (decrypted === testMessage) {
        setSuccess('Encryption test successful!');
      } else {
        setError('Encryption test failed - decrypted text does not match');
      }
    } catch (error) {
      console.error('Encryption test failed:', error);
      setError('Encryption test failed. Your key may be invalid.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            🔐 End-to-End Encryption
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            End-to-end encryption ensures your conversations are encrypted before leaving your device. 
            The server never sees your unencrypted messages.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded">
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded">
            <p className="text-sm text-green-600 dark:text-green-300">{success}</p>
          </div>
        )}

        {isEncryptionEnabled ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  End-to-end encryption is enabled
                </span>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleTestDecryption}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {isLoading ? 'Testing...' : 'Test Encryption'}
              </button>
              <button
                onClick={handleDisableEncryption}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Disable
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Encryption Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter a strong passphrase (min 8 characters)"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassphrase ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Passphrase
              </label>
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Confirm your passphrase"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded p-3">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> Your passphrase cannot be recovered if lost. 
                Make sure to remember it or store it securely.
              </p>
            </div>

            <button
              onClick={handleEnableEncryption}
              disabled={isLoading || !passphrase || !confirmPassphrase}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-md transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enabling Encryption...
                </div>
              ) : (
                'Enable End-to-End Encryption'
              )}
            </button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your encryption key is stored locally and never sent to the server. 
            All messages are encrypted before transmission.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EncryptionSettings;