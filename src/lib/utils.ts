import { POST } from "@/config/axios/requests";
import { Keypair } from "@solana/web3.js";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { createHash } from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function openInNewTab(url: string) {
  const win = window.open(url, "_blank");
  if (win) win.focus();
}

export function openInNewWindow(url: string) {
  window.open(
    url,
    "_blank",
    "toolbar=yes,scrollbars=yes,resizable=yes,width=1000,height=1000, left=500, top=500"
  );
}

export const uploadImage = async (
  file: File,
  accessToken: string
): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  // Send the file to the backend to handle S3 upload
  const { response, error } = await POST("/uploadImage", formData, {
    "Content-Type": "multipart/form-data",
    Authorization: `Bearer ${accessToken}`,
  });

  if (error || !response?.data?.url) {
    throw new Error("Failed to upload image");
  }

  return response.data.url;
};

export function bigintToString(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") {
    return obj.toString();
  } else if (Array.isArray(obj)) {
    return obj.map(bigintToString);
  } else if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, bigintToString(value)])
    );
  }
  return obj;
}

export function formatDates(entity: any): any {
  return {
    ...entity,
    createdAt: entity.createdAt ? entity.createdAt.toISOString() : null,
    updatedAt: entity.updatedAt ? entity.updatedAt.toISOString() : null,
  };
}




export  function generateBountyKeypair(bountyId: string): Keypair {
  const seedString = `octasol_final_bounty_prod_${bountyId}`;
  const hash = createHash('sha256').update(seedString).digest();
  const keypairSeed = hash.slice(0, 32);
  return Keypair.fromSeed(keypairSeed);
}
