# Frontend Encryption Setup

## Manual AES Key Setup

To enable encryption in the frontend, you need to manually add the AES key hash to localStorage.

### Steps:

1. **Open browser DevTools** (F12)
2. **Go to Application/Storage tab** → Local Storage
3. **Add new item:**
   - Key: `aes_key_hash`
   - Value: Your AES key hash (same as backend `AES_KEY_HASH` env var)

### Console Command:
```javascript
// Replace 'your_aes_key_hash_here' with your actual AES key hash
localStorage.setItem('aes_key_hash', 'your_aes_key_hash_here');
```

### Example:
```javascript
// Example AES key (32+ characters)
localStorage.setItem('aes_key_hash', 'a1b2c3d4e5f6789012345678901234567890abcdef');
```

### Verification:
```javascript
// Check if key is set
console.log('AES Key available:', localStorage.getItem('aes_key_hash') !== null);
```

## How It Works

The frontend will:
1. **Check for AES key** in localStorage
2. **Encrypt requests** for POST/PATCH endpoints
3. **Decrypt responses** for GET endpoints
4. **Handle encrypted SSE events** for chat streams
5. **Fallback gracefully** if no key is present (development mode)

## Encrypted Endpoints

- `POST /api/chat/` - Encrypted request payload
- `POST /api/chat/{id}` - Encrypted request payload  
- `GET /api/conversations/` - Encrypted response
- `GET /api/conversations/{id}` - Encrypted response
- SSE `encrypted_done` events - Automatically decrypted

## Debug Console Messages

When encryption is active, you'll see:
- ✅ Successful encryption/decryption operations
- ⚠️ Warnings when encryption is not available
- ❌ Error messages if encryption/decryption fails