import React from 'react'
import type { ReactNode } from 'react'

interface DataTableProps {
  headers: string[]
  headerKeys?: string[]
  children: ReactNode
  emptyMessage?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export function DataTable({ headers, headerKeys, children, emptyMessage, sortBy, sortDir, onSort }: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-surface-200 bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-50 border-b border-surface-200">
            {headers.map((h, i) => {
              const key = headerKeys?.[i]
              const active = key && sortBy === key
              const content = (
                <span className="inline-flex items-center gap-1">
                  {h}
                  {active && <span className="text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </span>
              )
              return (
                <th
                  key={i}
                  className={`text-left px-3 py-2.5 font-semibold text-surface-600 uppercase tracking-wider text-[10px] ${key && onSort ? 'cursor-pointer hover:text-surface-900 select-none' : ''}`}
                  onClick={key && onSort ? () => onSort(key) : undefined}
                >
                  {content}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {children}
        </tbody>
      </table>
      {emptyMessage && !React.Children.count(children) && (
        <div className="text-center py-8 text-surface-400 text-xs">{emptyMessage}</div>
      )}
    </div>
  )
}

interface DataRowProps {
  children: ReactNode
  onClick?: () => void
  className?: string
}

export function DataRow({ children, onClick, className = '' }: DataRowProps) {
  return (
    <tr
      className={`hover:bg-surface-50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function DataCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-surface-700 ${className}`}>{children}</td>
}
