import React, { createContext, useContext, useState, useEffect } from 'react';
import { encryptionService } from '../services/encryption';
import { useAuth } from './AuthContext';
import { setEncryptionFailureHandler } from '../services/api';

interface EncryptionContextType {
  isEncryptionReady: boolean;
  initializeEncryption: (userKey: string) => Promise<boolean>;
  requestEncryptionKey: () => void;
  isKeyPromptOpen: boolean;
  closeKeyPrompt: () => void;
  clearEncryption: () => void;
  handleDecryptionFailure: () => void;
}

const EncryptionContext = createContext<EncryptionContextType | null>(null);

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within EncryptionProvider');
  }
  return context;
};

export const EncryptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [isKeyPromptOpen, setIsKeyPromptOpen] = useState(false);
  const { user, getToken } = useAuth();

  useEffect(() => {
    // Check if encryption is already initialized when component mounts
    const checkEncryption = async () => {
      if (user) {
        // Check if there's a saved key hash in localStorage
        if (encryptionService.hasSavedKey()) {
          // User has used encryption before, prompt for key to restore session
          setIsKeyPromptOpen(true);
        } else {
          // First time user, prompt for key setup
          setIsKeyPromptOpen(true);
        }
      }
    };

    checkEncryption();
  }, [user, getToken]);

  const initializeEncryption = async (userKey: string): Promise<boolean> => {
    const success = await encryptionService.initializeWithKey(userKey);
    
    if (success) {
      setIsEncryptionReady(true);
      setIsKeyPromptOpen(false);
      return true;
    } else {
      // Failed to initialize encryption
      encryptionService.clear();
      return false;
    }
  };

  const requestEncryptionKey = () => {
    setIsKeyPromptOpen(true);
  };

  const closeKeyPrompt = () => {
    setIsKeyPromptOpen(false);
  };

  const clearEncryption = () => {
    encryptionService.clear();
    setIsEncryptionReady(false);
  };

  const handleDecryptionFailure = () => {
    // Auto re-prompt for AES key when decryption fails
    setIsEncryptionReady(false);
    setIsKeyPromptOpen(true);
  };

  useEffect(() => {
    // Set up the global decryption failure handler
    setEncryptionFailureHandler(handleDecryptionFailure);
  }, []);

  return (
    <EncryptionContext.Provider
      value={{
        isEncryptionReady,
        initializeEncryption,
        requestEncryptionKey,
        isKeyPromptOpen,
        closeKeyPrompt,
        clearEncryption,
        handleDecryptionFailure
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
};