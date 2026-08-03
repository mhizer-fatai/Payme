import { useRef } from 'react'

export default function PinDotsInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const setPin = (next: string) => onChange(next.replace(/\D/g, '').slice(0, 4))

  return (
    <div className="pin-entry">
      <label className="form-label">{label}</label>
      <button
        type="button"
        className="pin-dot-row"
        onClick={() => inputRef.current?.focus()}
        disabled={disabled}
        aria-label={label}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} className={`pin-dot ${value.length > index ? 'filled' : ''}`} />
        ))}
      </button>
      <input
        ref={inputRef}
        className="pin-hidden-input"
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        value={value}
        disabled={disabled}
        onChange={(event) => setPin(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Backspace') setPin(value.slice(0, -1))
        }}
      />
    </div>
  )
}
