/**
 * End-to-End Encryption Service using Web Crypto API
 * Implements AES-256-GCM encryption for secure communication
 */

export interface EncryptedPayload {
  encrypted_data: string; // Base64 encoded encrypted data
}

export interface EncryptionResult {
  encryptedPayload: EncryptedPayload;
  success: boolean;
  error?: string;
}

export interface DecryptionResult {
  data: any;
  success: boolean;
  error?: string;
}

class EncryptionService {
  private aesKey: CryptoKey | null = null;
  private keyHash: string | null = null;

  /**
   * Initialize encryption with user-provided AES key
   */
  async initializeWithKey(userKey: string): Promise<boolean> {
    try {
      // Generate SHA256 hash of the key
      const keyBytes = new TextEncoder().encode(userKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes);
      this.keyHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Debug: Log the hash calculation
      console.log('Frontend encryption debug:', {
        userKey,
        calculatedHash: this.keyHash,
        expectedHash: '87d452521c9a7f5c9052ae6190e900a46e2a2df5f144158c2fc20b797adb470b',
        hashMatch: this.keyHash === '87d452521c9a7f5c9052ae6190e900a46e2a2df5f144158c2fc20b797adb470b'
      });

      // Import AES key from the hash (use hash as key material)
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(hashBuffer),
        'AES-GCM',
        false,
        ['encrypt', 'decrypt']
      );

      this.aesKey = keyMaterial;
      
      // Store SHA256 hash in localStorage as per requirements
      localStorage.setItem('encryption_key_hash', this.keyHash);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      return false;
    }
  }

  /**
   * Check if encryption was previously initialized and load from storage
   */
  async loadFromStorage(): Promise<boolean> {
    const savedKeyHash = localStorage.getItem('encryption_key_hash');
    if (!savedKeyHash) {
      return false; // No saved key found
    }
    
    // We have a saved key hash, but we need the user to re-enter the key
    // to recreate the CryptoKey (which cannot be stored in localStorage)
    return false; // Always require re-entering key for security
  }

  /**
   * Check if encryption is initialized
   */
  isInitialized(): boolean {
    return this.aesKey !== null && this.keyHash !== null;
  }

  /**
   * Check if there is a saved key hash in localStorage
   */
  hasSavedKey(): boolean {
    return localStorage.getItem('encryption_key_hash') !== null;
  }

  /**
   * Get current key hash
   */
  getKeyHash(): string | null {
    return this.keyHash;
  }

  /**
   * Encrypt data using AES-GCM
   */
  async encrypt(data: any): Promise<EncryptionResult> {
    if (!this.aesKey || !this.keyHash) {
      return {
        encryptedPayload: { encrypted_data: '' },
        success: false,
        error: 'Encryption not initialized'
      };
    }

    try {
      // Convert data to JSON bytes
      const jsonString = JSON.stringify(data);
      const dataBytes = new TextEncoder().encode(jsonString);

      // Generate random IV (12 bytes for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the data
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.aesKey,
        dataBytes
      );

      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Encode as base64
      const base64Data = btoa(String.fromCharCode.apply(null, Array.from(combined)));

      return {
        encryptedPayload: {
          encrypted_data: base64Data
        },
        success: true
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      return {
        encryptedPayload: { encrypted_data: '' },
        success: false,
        error: 'Encryption failed'
      };
    }
  }

  /**
   * Decrypt base64 encoded encrypted data
   */
  async decrypt(encryptedData: string): Promise<DecryptionResult> {
    if (!this.aesKey) {
      return {
        data: null,
        success: false,
        error: 'Encryption not initialized'
      };
    }

    try {
      console.log('Decryption debug:', {
        dataLength: encryptedData.length,
        dataPreview: encryptedData.substring(0, 50) + '...',
        currentHash: this.keyHash
      });
      
      // Decode base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

      // Extract IV (first 12 bytes) and ciphertext
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.aesKey,
        ciphertext
      );

      // Convert to string and parse JSON
      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      const data = JSON.parse(decryptedText);

      return {
        data,
        success: true
      };
    } catch (error) {
      console.error('Decryption failed:', error);
      return {
        data: null,
        success: false,
        error: 'Decryption failed'
      };
    }
  }


  /**
   * Clear encryption data (logout)
   */
  clear(): void {
    this.aesKey = null;
    this.keyHash = null;
    localStorage.removeItem('encryption_key_hash');
  }
}

// Global encryption service instance
export const encryptionService = new EncryptionService();