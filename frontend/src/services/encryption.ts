/**
 * Frontend encryption service using Web Crypto API for Phase 4 end-to-end encryption.
 * Provides AES-256-GCM encryption/decryption with PBKDF2 key derivation.
 */

export interface EncryptedContent {
  content: string;
  encrypted: boolean;
  keyHash: string;
}

export interface EncryptionState {
  isEnabled: boolean;
  keyHash: string | null;
  isKeyValid: boolean;
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class EncryptionService {
  private static instance: EncryptionService;
  private cryptoKey: CryptoKey | null = null;
  private keyHash: string | null = null;
  private isEnabled: boolean = false;

  private constructor() {
    // Load encryption state from localStorage
    this.loadEncryptionState();
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Load encryption state from localStorage
   */
  private loadEncryptionState(): void {
    try {
      const encryptionState = localStorage.getItem('encryption_state');
      if (encryptionState) {
        const state: EncryptionState = JSON.parse(encryptionState);
        this.isEnabled = state.isEnabled;
        this.keyHash = state.keyHash;
      }
    } catch (error) {
      console.error('Failed to load encryption state:', error);
      this.clearEncryptionState();
    }
  }

  /**
   * Save encryption state to localStorage
   */
  private saveEncryptionState(): void {
    const state: EncryptionState = {
      isEnabled: this.isEnabled,
      keyHash: this.keyHash,
      isKeyValid: this.cryptoKey !== null
    };
    localStorage.setItem('encryption_state', JSON.stringify(state));
  }

  /**
   * Clear encryption state from localStorage and memory
   */
  clearEncryptionState(): void {
    this.cryptoKey = null;
    this.keyHash = null;
    this.isEnabled = false;
    localStorage.removeItem('encryption_state');
  }

  /**
   * Generate SHA256 hash of a string
   */
  private async generateHash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Derive AES key from passphrase using PBKDF2
   */
  private async deriveKey(passphrase: string, salt: string = 'chatai-gcp'): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      passphraseKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Initialize encryption with user passphrase
   */
  async initializeEncryption(passphrase: string): Promise<{ success: boolean; keyHash: string }> {
    try {
      // Generate key hash
      const keyHash = await this.generateHash(passphrase);
      
      // Derive crypto key
      const cryptoKey = await this.deriveKey(passphrase);
      
      // Store in memory
      this.cryptoKey = cryptoKey;
      this.keyHash = keyHash;
      this.isEnabled = true;
      
      // Save to localStorage
      this.saveEncryptionState();
      
      return { success: true, keyHash };
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw new EncryptionError('Failed to initialize encryption');
    }
  }

  /**
   * Encrypt text using AES-256-GCM
   */
  async encryptText(plaintext: string): Promise<EncryptedContent> {
    if (!this.isEnabled || !this.cryptoKey || !this.keyHash) {
      throw new EncryptionError('Encryption not initialized');
    }

    try {
      // Generate random IV (96 bits for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the text
      const encoder = new TextEncoder();
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.cryptoKey,
        encoder.encode(plaintext)
      );

      // Combine IV + encrypted data and encode as base64
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);
      
      const base64Data = btoa(String.fromCharCode(...combined));

      return {
        content: base64Data,
        encrypted: true,
        keyHash: this.keyHash
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new EncryptionError('Failed to encrypt text');
    }
  }

  /**
   * Decrypt text using AES-256-GCM
   */
  async decryptText(encryptedContent: EncryptedContent | string): Promise<string> {
    if (!this.isEnabled || !this.cryptoKey || !this.keyHash) {
      throw new DecryptionError('Encryption not initialized');
    }

    try {
      let encryptedData: string;
      let providedKeyHash: string;

      if (typeof encryptedContent === 'string') {
        encryptedData = encryptedContent;
        providedKeyHash = this.keyHash;
      } else {
        encryptedData = encryptedContent.content;
        providedKeyHash = encryptedContent.keyHash;
      }

      // Validate key hash
      if (providedKeyHash !== this.keyHash) {
        throw new DecryptionError('Invalid key hash for decryption');
      }

      // Decode base64
      const combined = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedBuffer = combined.slice(12);

      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.cryptoKey,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new DecryptionError('Failed to decrypt text');
    }
  }

  /**
   * Check if encryption is enabled and initialized
   */
  isEncryptionEnabled(): boolean {
    return this.isEnabled && this.cryptoKey !== null;
  }

  /**
   * Get current key hash
   */
  getKeyHash(): string | null {
    return this.keyHash;
  }

  /**
   * Validate current encryption state
   */
  validateEncryptionState(): boolean {
    return this.isEnabled && this.cryptoKey !== null && this.keyHash !== null;
  }

  /**
   * Process streaming chunk (decrypt if needed)
   */
  async processStreamingChunk(chunk: any): Promise<string> {
    if (!chunk) return '';

    // If chunk is encrypted, decrypt it
    if (chunk.encrypted && chunk.content && chunk.key_hash) {
      try {
        return await this.decryptText({
          content: chunk.content,
          encrypted: true,
          keyHash: chunk.key_hash
        });
      } catch (error) {
        console.error('Failed to decrypt streaming chunk:', error);
        throw new DecryptionError('Failed to decrypt streaming response');
      }
    }

    // Return plaintext content
    return chunk.content || chunk;
  }

  /**
   * Prepare message for API (encrypt if enabled)
   */
  async prepareMessageForAPI(message: string): Promise<{
    message: string | EncryptedContent;
    encrypted: boolean;
    keyHash?: string;
  }> {
    if (!this.isEncryptionEnabled()) {
      return {
        message,
        encrypted: false
      };
    }

    try {
      const encryptedContent = await this.encryptText(message);
      return {
        message: encryptedContent,
        encrypted: true,
        keyHash: this.keyHash!
      };
    } catch (error) {
      console.error('Failed to prepare encrypted message:', error);
      throw new EncryptionError('Failed to prepare encrypted message for API');
    }
  }

  /**
   * Process conversation data (decrypt messages if needed)
   */
  async processConversationData(conversationData: any): Promise<any> {
    if (!this.isEncryptionEnabled() || !conversationData.messages) {
      return conversationData;
    }

    try {
      const processedMessages = await Promise.all(
        conversationData.messages.map(async (message: any) => {
          if (message.content && typeof message.content === 'object' && message.content.encrypted) {
            try {
              const decryptedContent = await this.decryptText(message.content);
              return { ...message, content: decryptedContent };
            } catch (error) {
              console.error('Failed to decrypt message:', error);
              return { ...message, content: '[Decryption failed]' };
            }
          }
          return message;
        })
      );

      return { ...conversationData, messages: processedMessages };
    } catch (error) {
      console.error('Failed to process conversation data:', error);
      throw new DecryptionError('Failed to process conversation data');
    }
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();