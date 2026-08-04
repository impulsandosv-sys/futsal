import React, { useState, useMemo } from 'react'
import { useStore } from '@/store/store'
import type { PlantillaFuerza, FinalidadSesionFuerza } from '@/types'
import { FINALIDADES_FUERZA, getFinalidadLabel } from '@/domain/neuromuscular/fuerzaEngine'
import { TemplateFormModal } from '@/components/fuerza/TemplateFormModal'
import { TemplateDetailModal } from '@/components/fuerza/TemplateDetailModal'
import { StrengthFormModal } from '@/components/fuerza/StrengthFormModal'

type EstadoFilterOption = 'activas' | 'archivadas' | 'todas'

export const TemplateListPage: React.FC = () => {
  const { plantillas_fuerza, toggleActivaPlantillaFuerza } = useStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [finalidadFilter, setFinalidadFilter] = useState<FinalidadSesionFuerza | ''>('')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilterOption>('activas')

  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [templateToEdit, setTemplateToEdit] = useState<PlantillaFuerza | null>(null)

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<PlantillaFuerza | null>(null)

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [templateToApply, setTemplateToApply] = useState<PlantillaFuerza | null>(null)

  const filteredTemplates = useMemo(() => {
    return plantillas_fuerza.filter((t) => {
      if (estadoFilter === 'activas' && !t.activa) return false
      if (estadoFilter === 'archivadas' && t.activa) return false

      if (finalidadFilter && t.finalidad !== finalidadFilter) return false

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchNombre = t.nombre.toLowerCase().includes(term)
        const matchDesc = t.descripcion?.toLowerCase().includes(term) || false
        if (!matchNombre && !matchDesc) return false
      }

      return true
    })
  }, [plantillas_fuerza, estadoFilter, finalidadFilter, searchTerm])

  const handleOpenNew = () => {
    setTemplateToEdit(null)
    setIsFormModalOpen(true)
  }

  const handleOpenEdit = (template: PlantillaFuerza) => {
    setTemplateToEdit(template)
    setIsFormModalOpen(true)
  }

  const handleOpenDetail = (template: PlantillaFuerza) => {
    setSelectedTemplate(template)
    setIsDetailModalOpen(true)
  }

  const handleApply = (template: PlantillaFuerza) => {
    setTemplateToApply(template)
    setIsApplyModalOpen(true)
  }

  const handleToggleArchivada = async (template: PlantillaFuerza) => {
    await toggleActivaPlantillaFuerza(template.id_plantilla, !template.activa)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Plantillas de Fuerza</h1>
          <p className="text-xs text-surface-500">
            Catálogo de rutinas y prescripciones de fuerza previstas reutilizables.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>+</span> Nueva Plantilla
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] uppercase font-semibold text-surface-500 mb-1">
              Buscar por nombre
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ej. Hipertrofia..."
              className="w-full px-3 py-1.5 border border-surface-300 rounded-lg text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-surface-500 mb-1">
              Finalidad propuesta
            </label>
            <select
              value={finalidadFilter}
              onChange={(e) => setFinalidadFilter(e.target.value as FinalidadSesionFuerza | '')}
              className="w-full px-3 py-1.5 border border-surface-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">Todas las finalidades</option>
              {FINALIDADES_FUERZA.map((f) => (
                <option key={f} value={f}>
                  {getFinalidadLabel(f)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-surface-500 mb-1">
              Estado de Plantilla
            </label>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value as EstadoFilterOption)}
              className="w-full px-3 py-1.5 border border-surface-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
            >
              <option value="activas">Solo Activas</option>
              <option value="archivadas">Solo Archivadas</option>
              <option value="todas">Todas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de plantillas */}
      <div className="bg-white rounded-xl border border-surface-200 shadow-xs overflow-hidden">
        {filteredTemplates.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="text-surface-300 text-4xl">📋</div>
            <p className="text-sm font-semibold text-surface-700">Sin plantillas de fuerza</p>
            <p className="text-xs text-surface-500 max-w-sm mx-auto">
              No se encontraron plantillas que coincidan con los filtros aplicados.
            </p>
            <button
              onClick={handleOpenNew}
              className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 transition-colors"
            >
              Crear primera plantilla
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-50 text-surface-600 font-semibold border-b border-surface-200">
                <tr>
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Finalidad</th>
                  <th className="py-3 px-4 text-center">Ejercicios Prescritos</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredTemplates.map((t) => (
                  <tr key={t.id_plantilla} className="hover:bg-surface-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-surface-900">
                      <div>{t.nombre}</div>
                      {t.descripcion && (
                        <div className="text-[10px] text-surface-500 font-normal truncate max-w-xs">
                          {t.descripcion}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-surface-700">
                      {t.finalidad ? getFinalidadLabel(t.finalidad) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-surface-800">
                      {t.ejercicios?.length || 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.activa
                            ? 'bg-green-100 text-green-800'
                            : 'bg-surface-200 text-surface-700'
                        }`}
                      >
                        {t.activa ? 'Activa' : 'Archivada'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {t.activa && (
                        <button
                          onClick={() => handleApply(t)}
                          className="px-2.5 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 font-semibold rounded text-[11px] transition-colors"
                        >
                          Aplicar
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenDetail(t)}
                        className="text-surface-600 hover:text-surface-900 font-medium"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => handleOpenEdit(t)}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleArchivada(t)}
                        className={`${
                          t.activa ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'
                        } font-medium`}
                      >
                        {t.activa ? 'Archivar' : 'Restaurar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      <TemplateFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        templateToEdit={templateToEdit}
      />

      <TemplateDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        template={selectedTemplate}
        onApply={handleApply}
      />

      {isApplyModalOpen && templateToApply && (
        <StrengthFormModal
          isOpen={isApplyModalOpen}
          onClose={() => {
            setIsApplyModalOpen(false)
            setTemplateToApply(null)
          }}
          templateToApply={templateToApply}
        />
      )}
    </div>
  )
}
