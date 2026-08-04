import { useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { useStore } from '@/store/store'
import { validarProtocoloCMJ } from '@/domain/neuromuscular/cmjEngine'
import type { ProtocoloCMJ } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

export function CMJProtocolManagerModal({ open, onClose }: Props) {
  const protocolos = useStore((state) => state.protocolos_cmj)
  const addProtocolo = useStore((state) => state.addProtocoloCMJ)
  const updateProtocolo = useStore((state) => state.updateProtocoloCMJ)
  const activateProtocolo = useStore((state) => state.activateProtocoloCMJ)
  const deactivateProtocolo = useStore((state) => state.deactivateProtocoloCMJ)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleEdit = (p: ProtocoloCMJ) => {
    setEditingId(p.id_protocolo)
    setNombre(p.nombre)
    setDescripcion(p.descripcion || '')
    setError(null)
  }

  const handleCancel = () => {
    setEditingId(null)
    setNombre('')
    setDescripcion('')
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    
    // Obtener nombres activos, excluyendo el que estamos editando
    const activosActuales = protocolos
      .filter(p => p.activo && p.id_protocolo !== editingId)
      .map(p => p.nombre)

    const errorValidacion = validarProtocoloCMJ(nombre, activosActuales)
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }

    try {
      const ahora = new Date().toISOString()
      if (editingId) {
        const p = protocolos.find(x => x.id_protocolo === editingId)
        if (p) {
          await updateProtocolo({ ...p, nombre, descripcion, updatedAt: ahora })
        }
      } else {
        await addProtocolo({
          id_protocolo: 'cmj-prot-' + Date.now(),
          nombre,
          descripcion,
          activo: true,
          createdAt: ahora,
          updatedAt: ahora
        })
      }
      handleCancel()
    } catch (err: any) {
      setError(err.message || 'Error al guardar el protocolo')
    }
  }

  const handleToggleActive = async (p: ProtocoloCMJ) => {
    setError(null)
    try {
      if (p.activo) {
        await deactivateProtocolo(p.id_protocolo)
      } else {
        // Al activar, debemos asegurar que no colisiona con otro activo
        const activosActuales = protocolos.filter(x => x.activo).map(x => x.nombre)
        const errorValidacion = validarProtocoloCMJ(p.nombre, activosActuales)
        if (errorValidacion) {
          setError(errorValidacion)
          return
        }
        await activateProtocolo(p.id_protocolo)
      }
    } catch (err: any) {
      setError(err.message || 'Error al cambiar el estado')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Gestión de Protocolos CMJ" width="max-w-3xl">
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
          <h4 className="font-medium text-surface-800 mb-3">
            {editingId ? 'Editar Protocolo' : 'Nuevo Protocolo'}
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Nombre *</label>
              <input 
                type="text"
                className="w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: CMJ Abalakov"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Descripción</label>
              <textarea 
                className="w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Detalles sobre el protocolo..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-100 border border-surface-300 rounded-md"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleSave}
                disabled={!nombre.trim()}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50"
              >
                {editingId ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-surface-800 mb-3">Protocolos Registrados</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 text-sm text-surface-500">
                  <th className="pb-2 font-medium">Nombre</th>
                  <th className="pb-2 font-medium">Descripción</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-surface-100">
                {protocolos.map(p => (
                  <tr key={p.id_protocolo} className={!p.activo ? 'opacity-60' : ''}>
                    <td className="py-3 font-medium text-surface-900">{p.nombre}</td>
                    <td className="py-3 text-surface-600 truncate max-w-[200px]">{p.descripcion || '—'}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.activo ? 'bg-green-100 text-green-800' : 'bg-surface-100 text-surface-800'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleToggleActive(p)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button 
                          onClick={() => handleEdit(p)}
                          className="text-surface-600 hover:text-surface-900"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
