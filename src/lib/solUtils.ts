// /lib/solanaUtils.ts
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

/**
 * Verifies a Solana wallet signature
 * @param publicKey - The wallet's public key as a string
 * @param signature - The signature as a number array
 * @param message - The original message that was signed
 * @returns boolean indicating if signature is valid
 */
export function verifySignature(
  publicKey: string, 
  signature: number[], 
  message: string
): boolean {
  try {
    // Validate inputs
    if (!publicKey || !signature || !message) {
      return false;
    }
    
    if (signature.length !== 64) {
      return false;
    }
    
    // Convert public key string to bytes
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Convert signature array to Uint8Array
    const signatureBytes = new Uint8Array(signature);
    
    // Verify the signature using tweetnacl
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    return false;
  }
}

// Simple message generation for wallet verification
/**
 * Generates a verification message for wallet signing
 * @param walletAddress - The wallet address to include in message
 * @param timestamp - Optional timestamp for deterministic generation
 * @returns A message string to be signed
 */
export function generateNonce(walletAddress?: string, timestamp?: number): string {
  const currentTimestamp = timestamp || Date.now();
  // Use a simpler message format that's more compatible with Solana wallets
  const baseMessage = `Sign this message to verify your wallet ownership.\n\nWallet: ${walletAddress}\nTimestamp: ${currentTimestamp}`;
  
  return baseMessage;
}

