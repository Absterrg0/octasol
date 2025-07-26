// /app/api/auth/link-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, generateNonce } from '@/lib/solUtils';
import { setWalletAddress } from '@/utils/dbUtils';

export async function POST(req: NextRequest) {
  try {
    const { publicKey, signature, githubId, timestamp } = await req.json();
    
    // Validate publicKey
    if (!publicKey || typeof publicKey !== 'string') {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    if (!signature) {
      // Step 1: Generate message for user to sign
      const currentTimestamp = Date.now();
      const message = generateNonce(publicKey, currentTimestamp);
      
      return NextResponse.json({ 
        message,
        publicKey,
        timestamp: currentTimestamp
      });
    } else {
      // Step 2: Verify the signature and store wallet
      
      // Use the timestamp from the request to regenerate the same message
      if (!timestamp) {
        return NextResponse.json({ error: 'Timestamp is required for verification' }, { status: 400 });
      }
      
      const expectedMessage = generateNonce(publicKey, timestamp);
      
      // Ensure signature is in the correct format
      let signatureArray: number[];
      if (Array.isArray(signature)) {
        signatureArray = signature;
      } else if (signature instanceof Uint8Array) {
        signatureArray = Array.from(signature);
      } else {
        return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 });
      }
      
      // Verify signature
      const isValid = verifySignature(publicKey, signatureArray, expectedMessage);
      
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }

      // Store the wallet address
      const walletRecord = await setWalletAddress(githubId, publicKey);
      
      return NextResponse.json({ 
        message: 'Wallet registered successfully',
        wallet: walletRecord
      });
    }
  } catch (error) {
    console.error('Wallet linking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' }, 
    { status: 405, headers: { Allow: 'POST' } }
  );
}