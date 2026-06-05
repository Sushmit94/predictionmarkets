"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS, IDENTITY_ABI } from "@/lib/wagmi";

export function useIdentity(address?: `0x${string}`) {
  const { data: isWhitelisted, isLoading } = useReadContract({
    address: CONTRACTS.IDENTITY,
    abi: IDENTITY_ABI,
    functionName: "isWhitelisted",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return { isWhitelisted: isWhitelisted ?? false, isLoading };
}