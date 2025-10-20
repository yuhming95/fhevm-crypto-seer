// hooks/useFHECryptoSeerWagmi.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHECryptoSeerWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: fheCryptoSeer } = useDeployedContractInfo({
    contractName: "FHECryptoSeer",
    chainId: allowedChainId,
  });

  type FHECryptoSeerInfo = Contract<"FHECryptoSeer"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContract = Boolean(fheCryptoSeer?.address && fheCryptoSeer?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(fheCryptoSeer!.address, (fheCryptoSeer as FHECryptoSeerInfo).abi, providerOrSigner);
  };

  const { data: myPredictionHandle, refetch: refreshMyPredictionHandle } = useReadContract({
    address: hasContract ? (fheCryptoSeer!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((fheCryptoSeer as FHECryptoSeerInfo).abi as any) : undefined,
    functionName: "getUserPrediction" as const,
    args: [accounts ? accounts[0] : ""],
    query: {
      enabled: Boolean(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const handle = useMemo(() => (myPredictionHandle as string | undefined) ?? undefined, [myPredictionHandle]);
  const hasPredicted = useMemo(() => !!handle && handle !== ethers.ZeroHash && handle !== "0x" && handle !== "0x0", [handle]);

  const requests = useMemo(() => (hasContract && handle && handle !== ethers.ZeroHash ? [{ handle, contractAddress: fheCryptoSeer!.address }] as const : undefined), [hasContract, fheCryptoSeer?.address, handle]);

  const { canDecrypt, decrypt, isDecrypting, message: decMsg, results } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  const clearPrediction = useMemo(() => {
    if (!handle) return undefined;
    const clear = results[handle];
    return clear ? { handle, clear } as const : undefined;
  }, [handle, results]);

  const isDecrypted = useMemo(() => !!handle && typeof results?.[handle] !== "undefined" && BigInt(results[handle]) !== BigInt(0), [handle, results]);

  const decryptMyPrediction = decrypt;

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: fheCryptoSeer?.address,
  });

  const canPredict = useMemo(() => Boolean(hasContract && instance && hasSigner && !isProcessing), [hasContract, instance, hasSigner, isProcessing]);

  const getEncryptionMethodFor = (functionName: "predict" | "updatePrediction") => {
    const functionAbi = fheCryptoSeer?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi) return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` };
    const firstInput = functionAbi.inputs?.[0];
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined };
  };

  const executePrediction = useCallback(async (projectId: number) => {
    if (isProcessing || projectId <= 0) return;
    setIsProcessing(true);
    setMessage(`${hasPredicted ? "Updating" : "Encrypting"} prediction for project #${projectId}...`);
    try {
      const { method, error } = getEncryptionMethodFor(hasPredicted ? "updatePrediction" : "predict");
      if (!method) return setMessage(error ?? "Encryption method not found");

      const enc = await encryptWith(builder => {
        (builder as any)[method](projectId);
      });
      if (!enc) return setMessage("Encryption failed");

      const writeContract = getContract("write");
      if (!writeContract) return setMessage("Contract or signer not available");

      const params = buildParamsFromAbi(enc, fheCryptoSeer!.abi as any[], hasPredicted ? "updatePrediction" : "predict");
      const tx = await writeContract[hasPredicted ? "updatePrediction" : "predict"](...params, { gasLimit: 300_000 });
      setMessage("Waiting for transaction...");
      await tx.wait();
      setMessage(`Prediction(${projectId}) ${hasPredicted ? "updated" : "submitted"}!`);
      await refreshMyPredictionHandle();
    } catch (e) {
      setMessage(`Prediction failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, encryptWith, getContract, refreshMyPredictionHandle, fheCryptoSeer?.abi]);

  return {
    contractAddress: fheCryptoSeer?.address,
    canDecrypt,
    canPredict,
    decryptMyPrediction,
    executePrediction,
    refreshMyPredictionHandle,
    isDecrypted,
    message,
    clear: clearPrediction?.clear,
    handle,
    isDecrypting,
    isProcessing,
    hasPredicted,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
