import { useState, useEffect } from 'react'

interface InlineEditCellProps {
  value: number
  onSave: (newValue: number) => void
}

export function InlineEditCell({ value, onSave }: InlineEditCellProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  useEffect(() => {
    setVal(value)
  }, [value])

  if (editing) {
    return (
      <input
        type="number"
        min={1}
        max={10}
        className="w-12 border border-primary-500 rounded px-1 py-0.5 text-xs"
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        onBlur={() => {
          setEditing(false)
          if (val !== value) onSave(val)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setEditing(false)
            if (val !== value) onSave(val)
          }
        }}
        autoFocus
      />
    )
  }
  return (
    <span 
      onClick={() => setEditing(true)} 
      className="cursor-pointer hover:bg-primary-50 px-1 py-0.5 rounded transition-colors block w-full"
    >
      {value}
    </span>
  )
}
