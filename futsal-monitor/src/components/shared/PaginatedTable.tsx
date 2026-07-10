import type { ReactNode } from 'react'
import React from 'react'
import { useState } from 'react'

interface PaginatedTableProps {
  headers: string[]
  children: ReactNode
  emptyMessage?: string
  pageSize?: number
  totalItems?: number
}

export function PaginatedTable({ headers, children, emptyMessage, pageSize = 25, totalItems }: PaginatedTableProps) {
  const [page, setPage] = useState(0)
  const childArray = React.Children.toArray(children)
  const total = totalItems ?? childArray.length
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-200 bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-50 border-b border-surface-200">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2.5 font-semibold text-surface-600 uppercase tracking-wider text-[10px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {childArray.slice(page * pageSize, (page + 1) * pageSize)}
        </tbody>
      </table>
      {emptyMessage && childArray.length === 0 && (
        <div className="text-center py-8 text-surface-400 text-xs">{emptyMessage}</div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-surface-200 bg-surface-50">
          <span className="text-[10px] text-surface-500">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="text-[10px] text-surface-600 hover:text-surface-800 px-1.5 py-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ««
            </button>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="text-[10px] text-surface-600 hover:text-surface-800 px-1.5 py-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              «
            </button>
            <span className="text-[10px] text-surface-700 font-medium px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="text-[10px] text-surface-600 hover:text-surface-800 px-1.5 py-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              »
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="text-[10px] text-surface-600 hover:text-surface-800 px-1.5 py-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface PRowProps {
  children: ReactNode
  onClick?: () => void
  className?: string
}

export function PRow({ children, onClick, className = '' }: PRowProps) {
  return (
    <tr
      className={`hover:bg-surface-50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function PCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-surface-700 ${className}`}>{children}</td>
}
