// /app/api/unlink-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { logToDiscord } from '@/utils/logger';
import { setWalletAddress } from '@/utils/dbUtils';

export async function POST(req: NextRequest) {
  try {
    const {githubId} = await req.json();

    await setWalletAddress(githubId, null);

    await logToDiscord(
      `User ${githubId} unlinked their wallet`,
      "INFO"
    );

    return NextResponse.json({ 
      message: 'Wallet unlinked successfully',
      success: true
    });

  } catch (error) {
    console.error('Wallet unlinking error:', error);
    await logToDiscord(
      `unlinkWallet: ${(error as any).message}`,
      "ERROR"
    );
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

