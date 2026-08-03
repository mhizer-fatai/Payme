type BridgeStage = 'idle' | 'preparing' | 'submitting' | 'confirming' | 'recording' | 'complete' | 'error'

const steps: Array<{ id: BridgeStage; label: string }> = [
  { id: 'preparing', label: 'Prepare route' },
  { id: 'submitting', label: 'Submit bridge' },
  { id: 'confirming', label: 'Confirm settlement' },
  { id: 'recording', label: 'Record receipt' },
]

export default function BridgeStatusTimeline({
  stage,
  sourceLabel,
  destinationLabel = 'Arc Testnet',
}: {
  stage: BridgeStage
  sourceLabel: string
  destinationLabel?: string
}) {
  const activeIndex = steps.findIndex(step => step.id === stage)
  const doneAll = stage === 'complete'

  return (
    <div className="bridge-timeline">
      <div className="bridge-route">
        <span>{sourceLabel}</span>
        <strong>to</strong>
        <span>{destinationLabel}</span>
      </div>
      <div className="bridge-steps">
        {steps.map((step, index) => {
          const done = doneAll || (activeIndex > index && activeIndex !== -1)
          const active = activeIndex === index
          return (
            <div key={step.id} className={`bridge-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              <span className="bridge-dot">{done ? 'OK' : index + 1}</span>
              <span>{step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { BridgeStage }
