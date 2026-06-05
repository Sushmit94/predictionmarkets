"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS, ERC20_ABI } from "@/lib/wagmi";

export function useGDollarBalance(address?: `0x${string}`) {
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.G_DOLLAR,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return { balance: balance ??  BigInt(0), refetchBalance };
}

export function useGDollarAllowance(owner?: `0x${string}`, spender?: `0x${string}`) {
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.G_DOLLAR,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!(owner && spender) },
  });

  return { allowance: allowance ??  BigInt(0), refetchAllowance };
}