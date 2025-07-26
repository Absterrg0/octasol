'use client'

import React from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

require("@solana/wallet-adapter-react-ui/styles.css");




export default function SolanaProvider({children}:{children:React.ReactNode}){
    
    const endpoint = process.env.NEXT_PUBLIC_BLOCKCHAIN_URL || clusterApiUrl('devnet');

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={[]} autoConnect>
                <WalletModalProvider>
                {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}