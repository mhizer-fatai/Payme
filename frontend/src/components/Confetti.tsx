import { useEffect, useState } from 'react'

interface ConfettiPiece {
  id: number
  x: number
  y: number
  rotation: number
  delay: number
  duration: number
  color: string
  size: number
  shape: 'circle' | 'square' | 'triangle'
}

/**
 * Renders a celebration confetti effect that explodes from the center and drifts down.
 */
export default function Confetti({ count = 80 }: { count?: number }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    const shapes: Array<'circle' | 'square' | 'triangle'> = ['circle', 'square', 'triangle']
    const colors = [
      '#FFC700', '#FF0055', '#00FF66', '#00E5FF', '#FF00AA', 
      '#9900FF', '#FF5E00', '#FFEC00', '#00FFCC', '#FF0077'
    ]

    const arr: ConfettiPiece[] = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * 2 * Math.PI
      const distance = 80 + Math.random() * 220
      
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance - 80

      arr.push({
        id: i,
        x,
        y,
        rotation: Math.random() * 720 - 360,
        delay: Math.random() * 0.3,
        duration: 1.5 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      })
    }
    setPieces(arr)
  }, [count])

  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map(p => {
        let borderRadius = '0%'
        let clipPath = 'none'
        if (p.shape === 'circle') {
          borderRadius = '50%'
        } else if (p.shape === 'triangle') {
          clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)'
        }

        return (
          <div
            key={p.id}
            className="confetti-piece"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${p.size}px`,
              height: `${p.shape === 'triangle' ? p.size * 0.86 : p.size}px`,
              backgroundColor: p.color,
              borderRadius,
              clipPath,
              transform: 'translate(-50%, -50%)',
              opacity: 0,
              '--tx': `${p.x}px`,
              '--ty': `${p.y + 120}px`,
              '--rot': `${p.rotation}deg`,
              animation: `confetti-explosion ${p.duration}s cubic-bezier(0.1, 0.8, 0.3, 1) ${p.delay}s forwards`,
            } as React.CSSProperties}
          />
        )
      })}
    </div>
  )
}
