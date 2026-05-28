import { type FC } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { KunCharCanvas } from './KunCharCanvas'
import type { BotState } from './useShibaAnimation'

export interface KunBotState {
  text: string
  state: BotState
}

interface KunBot3DProps {
  bot: KunBotState
  size?: number
}

export const KunBot3D: FC<KunBot3DProps> = ({ bot, size = 220 }) => {
  const isSpeaking  = bot.state === 'speaking'
  const isListening = bot.state === 'listening'

  return (
    <div className="relative flex flex-col items-center" style={{ width: size + 40 }}>

      {/* Speaking pulse rings */}
      {isSpeaking && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {[1.1, 1.24, 1.4].map((s, i) => (
            <div
              key={i}
              className="absolute rounded-full border-2 border-[#e07828]/28"
              style={{
                width:  size * s,
                height: size * s,
                animation: `kun-ring 1.4s ease-out ${i * 0.3}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Listening ring */}
      {isListening && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="absolute rounded-full border-4 border-blue-400/40"
            style={{
              width:  size * 1.07,
              height: size * 1.07,
              animation: 'kun-listen 1.2s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* Canvas-drawn character */}
      <KunCharCanvas state={bot.state} displaySize={size} />

      {/* Speech bubble */}
      <AnimatePresence>
        {bot.text && (
          <motion.div
            key={bot.state + bot.text.slice(0, 12)}
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="relative mt-2 max-w-xs rounded-2xl rounded-tl-sm px-4 py-3 text-center text-sm font-medium text-[#1a3c2e] shadow-md"
            style={{
              background:     'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              border:         '1px solid rgba(194,232,212,0.8)',
            }}
          >
            {bot.text}
            {isSpeaking && (
              <span className="ml-1 inline-block animate-pulse text-[#2d8a62]">▌</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
