"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS, ERC20_ABI } from "@/lib/wagmi";

export function useGDollarBalance(address?: `0x${string}`, tokenAddress: `0x${string}` = CONTRACTS.G_DOLLAR) {
  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance }= useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return { balance: balance ?? BigInt(0), balanceLoading, refetchBalance };
}

export function useGDollarAllowance(owner?: `0x${string}`, spender?: `0x${string}`, tokenAddress: `0x${string}` = CONTRACTS.G_DOLLAR) {
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!(owner && spender) },
  });

  return { allowance: allowance ??  BigInt(0), refetchAllowance };
}
