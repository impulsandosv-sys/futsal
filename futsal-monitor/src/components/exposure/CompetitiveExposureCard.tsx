import React, { useId } from "react"
import type { RPE_Partido } from "@/types"
import { calcularExposicionCompetitiva } from "@/domain/exposure/matchExposure"
import { DataCell } from "@/components/shared/DataTable"

interface Props {
  registros: RPE_Partido[]
  fechaCorteISO: string
  modo?: "completo" | "compacto" | "fila"
}

export function CompetitiveExposureCard({ registros, fechaCorteISO, modo = "completo" }: Props) {
  const exp = calcularExposicionCompetitiva(registros, fechaCorteISO)
  const uniqueId = useId().replace(/:/g, "-")


  const labelCalidad = (calidad: string) => {
    switch (calidad) {
      case "completa": return "Completa"
      case "parcial": return "Parcial"
      case "insuficiente": return "Datos competitivos incompletos"
      case "sin_registros_competitivos": return "Sin registros competitivos"
      default: return calidad
    }
  }

  const colorCalidad = (calidad: string) => {
    switch (calidad) {
      case "completa": return "bg-green-50 text-green-700 border border-green-200"
      case "parcial": return "bg-amber-50 text-amber-700 border border-amber-300"
      case "insuficiente": return "bg-surface-100 text-surface-600 border border-surface-200"
      case "sin_registros_competitivos": return "bg-surface-100 text-surface-500 border border-surface-200"
      default: return "bg-surface-100 text-surface-500 border border-surface-200"
    }
  }


  const tooltipCalidad = () => {
    if (exp.calidadDato === "sin_registros_competitivos") return "Sin registros competitivos disponibles en la ventana"
    if (exp.calidadDato === "insuficiente") return "Datos competitivos incompletos o inconsistentes"
    if (exp.calidadDato === "parcial") return "Dato parcial: interpretar junto con el registro de partido"
    return "Contexto de exposición competitiva"
  }

  const renderCalidadTooltip = () => (
    <div className="relative group/calidad w-fit">
      <span
        className={"z-10 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium peer cursor-help " + colorCalidad(exp.calidadDato)}
        tabIndex={0}
        aria-describedby={"tooltip-calidad-" + uniqueId}
        onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }}
      >
        {labelCalidad(exp.calidadDato)}
      </span>
      <div
        id={"tooltip-calidad-" + uniqueId}
        role="tooltip"
        className="pointer-events-none absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/calidad:block peer-focus:block w-48 p-2 bg-surface-800 text-white text-[10px] rounded shadow-lg text-center z-50"
      >
        {tooltipCalidad()}
      </div>
    </div>
  )

  if (modo === "fila") {
    return (
      <>
        <DataCell>{exp.minutos7d ?? "—"}</DataCell>
        <DataCell>{exp.partidosJugados7d}</DataCell>
        <DataCell>{exp.convocatorias7d}</DataCell>
        <DataCell>
          {renderCalidadTooltip()}
        </DataCell>
      </>
    )
  }

  if (modo === "compacto") {
    return (
      <div className="flex flex-col gap-1 mt-1">
        {renderCalidadTooltip()}
        {exp.calidadDato !== "sin_registros_competitivos" && exp.calidadDato !== "insuficiente" && (
          <div className="flex items-center gap-2 text-[9px] font-medium text-surface-600">
            <span>{exp.minutos7d ?? "—"} min / {exp.convocatorias7d} conv.</span>
            {exp.ratioCambioExposicion !== null ? (
              <div className="relative group/ratio">
                <span
                  className="border-b border-dashed border-surface-300 cursor-help peer"
                  tabIndex={0}
                  aria-describedby={"tooltip-ratio-" + uniqueId}
                  onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }}
                >
                  Ratio: {exp.ratioCambioExposicion.toFixed(2)}
                </span>
                <div
                  id={"tooltip-ratio-" + uniqueId}
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/ratio:block peer-focus:block w-48 p-2 bg-surface-800 text-white text-[10px] rounded shadow-lg text-center z-50"
                >
                  Compara los minutos de los últimos 7 días con la media semanal de los últimos 28 días. Es un indicador descriptivo, no una predicción de riesgo.
                </div>
              </div>
            ) : (<span>Ratio: —</span>)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-surface-700">Exposición competitiva</h3>
        {renderCalidadTooltip()}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-surface-500">Minutos (7d / 28d)</span>
          <span className="text-sm font-semibold text-surface-800">
            {exp.minutos7d ?? "—"} / {exp.minutos28d ?? "—"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-surface-500">Partidos (7d / 28d)</span>
          <span className="text-xs font-medium text-surface-700">
            {exp.partidosJugados7d} / {exp.partidosJugados28d}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-surface-500">Convocatorias (7d / 28d)</span>
          <span className="text-xs font-medium text-surface-700">
            {exp.convocatorias7d} / {exp.convocatorias28d}
          </span>
        </div>

        {exp.convocadaSinMinutos28d > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-surface-500">Conv. sin minutos (28d)</span>
            <span className="text-xs font-medium text-surface-700">
              {exp.convocadaSinMinutos28d}
            </span>
          </div>
        )}

        {exp.porcentajeExposicion7d !== null ? (
          <div className="flex items-center justify-between pt-2 border-t border-surface-100">
            <span className="text-[10px] text-surface-500">% Exposición (7d)</span>
            <span className="text-xs font-semibold text-primary-700">
              {Math.round(exp.porcentajeExposicion7d)}%
            </span>
          </div>
        ) : null}

        {exp.referenciaSemanal28d !== null ? (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-surface-500">Referencia 28d</span>
            <span className="text-xs font-medium text-surface-700">
              {Math.round(exp.referenciaSemanal28d)} min/sem
            </span>
          </div>
        ) : null}

        {exp.ratioCambioExposicion !== null ? (
          <div className="flex items-center justify-between relative group/ratio">
            <span
              className="text-[10px] text-surface-500 cursor-help border-b border-dashed border-surface-300 peer"
              tabIndex={0}
              aria-describedby={"tooltip-ratio-full-" + uniqueId}
              onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }}
            >
              Ratio de cambio
            </span>
            <div
              id={"tooltip-ratio-full-" + uniqueId}
              role="tooltip"
              className="pointer-events-none absolute bottom-full right-0 mb-1 hidden group-hover/ratio:block peer-focus:block w-48 p-2 bg-surface-800 text-white text-[10px] rounded shadow-lg z-50"
            >
              Compara los minutos de los últimos 7 días con la media semanal de los últimos 28 días. Es un indicador descriptivo, no una predicción de riesgo.
            </div>
            <span className="text-xs font-semibold text-primary-700">
              {exp.ratioCambioExposicion.toFixed(2)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
