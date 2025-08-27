'use client'

import React from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl, Cluster } from "@solana/web3.js";


import "@solana/wallet-adapter-react-ui/styles.css"




export default function SolanaProvider({children}:{children:React.ReactNode}){
    
    const endpoint = clusterApiUrl(process.env.NEXT_PUBLIC_SOLANA_CLUSTER as Cluster || "devnet");

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