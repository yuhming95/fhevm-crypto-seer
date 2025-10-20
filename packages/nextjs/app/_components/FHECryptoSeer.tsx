"use client"

import React, { useMemo, useState, useEffect } from "react"
import { useAccount } from "wagmi"
import ClipLoader from "react-spinners/ClipLoader"
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton"
import { useFhevm } from "@fhevm-sdk"
import { useFHECryptoSeerWagmi } from "~~/hooks/useFHECryptoSeerWagmi"

const PROJECTS = [
  { id: 1, name: "Zama", image: "/zama.jpg" },
  { id: 2, name: "Sui", image: "/sui.jpg" },
  { id: 3, name: "Story", image: "/story.jpg" },
  { id: 4, name: "Berachain", image: "/berachain.jpg" },
  { id: 5, name: "Monad", image: "/monad.jpg" },
  { id: 6, name: "Somnia", image: "/somnia.jpg" },
]

export const FHECryptoSeer = () => {
  const { isConnected, chain, address } = useAccount()
  const chainId = chain?.id

  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), [])

  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  }

  // Tạo instance FHEVM
  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  })

  // Hook CryptoSeer với instance
  const cryptoSeer = useFHECryptoSeerWagmi({ instance: fhevmInstance, initialMockChains })

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messageLocal, setMessageLocal] = useState<string | null>(null)

  const handlePredict = async (projectId: number) => {
    setSelectedId(projectId)
    setMessageLocal(null)
    try {
      await cryptoSeer.executePrediction(projectId)
    } catch (err) {
      console.error(err)
      setMessageLocal("❌ Prediction failed")
    }
  }

  const handleDecrypt = async () => {
    setMessageLocal(null)
    try {
      await cryptoSeer.decryptMyPrediction()
    } catch (err) {
      console.error(err)
      setMessageLocal("❌ Decryption failed")
    }
  }


  useEffect(() => {
    if(cryptoSeer.clear) {
      setSelectedId(Number(cryptoSeer.clear))
    }
  }, [cryptoSeer.clear]);

  const selectedProject = PROJECTS.find(p => p.id === selectedId)
  const decryptedProject = PROJECTS.find(p => p.id === Number(cryptoSeer.clear))

  const printProperty = (name: string, value: unknown) => {
    const val = value ?? "N/A"
    return (
      <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 rounded-md mb-2">
        <span className="font-medium text-gray-800">{name}</span>
        <span className="font-mono text-sm px-2 py-1 rounded bg-gray-100 text-gray-900">{String(val)}</span>
      </div>
    )
  }

  const ProjectButton = ({
    project,
    isSelected,
    onClick,
    disabled,
  }: {
    project: typeof PROJECTS[number]
    isSelected: boolean
    onClick: () => void
    disabled: boolean
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex flex-col items-center rounded-[10px] p-6 transition-all duration-200 border-2 cursor-pointer
        ${isSelected
          ? "bg-gradient-to-br from-pink-300 to-purple-300 text-white shadow-inner scale-105 border-purple-400"
          : "bg-white hover:bg-pink-50 border-pink-200 text-gray-800 hover:border-pink-300"}
      `}
    >
      <div className="w-24 h-24 rounded-full overflow-hidden shadow-md mb-3 bg-gradient-to-tr from-pink-100 to-purple-100 flex items-center justify-center relative">
        <img src={project.image} alt={project.name} className="w-20 h-20 object-contain" />
        {isSelected && <div className="absolute inset-0 rounded-[10px] bg-purple-300 blur-xl animate-pulse z-[-1]" />}
      </div>
      <span className="text-lg font-semibold">{project.name}</span>
    </button>
  )

  return (
    <div className="w-full flex flex-col justify-between p-6 font-[Quicksand,sans-serif]">
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-4xl w-full bg-white/80 backdrop-blur-xl rounded-[10px] shadow-xl border border-white/40 p-10">
          <h1 className="text-4xl font-extrabold text-center text-purple-600 mb-3 drop-shadow-sm">
            🔮 FHE CryptoSeer
          </h1>
          <p className="text-center text-gray-600 mb-10">
            Predict the <span className="text-purple-500 font-semibold">crypto project</span> that will shine in 2025 ✨
          </p>

          {!isConnected ? (
            <div className="flex justify-center">
              <RainbowKitCustomConnectButton />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-6">
                {PROJECTS.map(p => (
                  <ProjectButton
                    key={p.id}
                    project={p}
                    isSelected={selectedId === p.id}
                    onClick={() => handlePredict(p.id)}
                    disabled={cryptoSeer.isProcessing}
                  />
                ))}
              </div>

              <div className="mt-4">
                {printProperty("Prediction Handle", cryptoSeer.handle ?? "N/A")}
                {printProperty("Encrypted Value", cryptoSeer.handle ? cryptoSeer.handle : "N/A")}
                {printProperty("Decrypted Value", cryptoSeer.isDecrypted ? `${cryptoSeer.clear} (${decryptedProject?.name})` ?? "N/A" : "N/A")}
                {printProperty("Message", messageLocal || cryptoSeer.message || "N/A")}
              </div>

              <div className="text-center mt-4">
                <button
                  onClick={handleDecrypt}
                  disabled={cryptoSeer.isDecrypting}
                  className={`inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold shadow-md
                    bg-purple-400 hover:bg-purple-500 text-white transition-transform duration-200
                    ${!cryptoSeer.canDecrypt ? "opacity-50 cursor-not-allowed" : "hover:scale-105"}
                  `}
                >
                  {cryptoSeer.isDecrypting ? "⏳ Decrypting..." : "🔓 Decrypt My Prediction"}
                </button>
              </div>

              {cryptoSeer.isProcessing && (
                <div className="mt-6 flex justify-center">
                  <ClipLoader color="#a855f7" size={40} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Powered by Fully Homomorphic Encryption 🔐 <br />
        Designed in pastel 💕
      </p>
    </div>
  )
}
