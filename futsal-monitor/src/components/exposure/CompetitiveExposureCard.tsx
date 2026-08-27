import React from "react"
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

  const labelCalidad = (calidad: string) => {
    switch (calidad) {
      case "completa": return "Completa"
      case "parcial": return "Parcial"
      case "insuficiente": return "Datos incompletos"
      case "sin_registros_competitivos": return "Sin registros competitivos"
      default: return calidad
    }
  }

  const colorCalidad = (calidad: string) => {
    switch (calidad) {
      case "completa": return "bg-green-50 text-green-700 border border-green-200"
      case "parcial": return "bg-surface-100 text-surface-700 border border-surface-300"
      case "insuficiente": return "bg-surface-100 text-surface-600 border border-surface-200"
      case "sin_registros_competitivos": return "bg-surface-100 text-surface-500 border border-surface-200"
      default: return "bg-surface-100 text-surface-500 border border-surface-200"
    }
  }

  const tooltipCalidad = () => {
    if (exp.calidadDato === "sin_registros_competitivos") return "Sin registros competitivos disponibles en la ventana"
    if (exp.calidadDato === "insuficiente") return "Datos competitivos incompletos o inconsistentes"
    if (exp.calidadDato === "parcial") return "Dato parcial: interpretar junto con el registro de partido"
    return "Contexto de exposici�n competitiva"
  }

  if (modo === "fila") {
    return (
      <>
        <DataCell>{exp.minutos7d ?? "�"}</DataCell>
        <DataCell>{exp.partidosJugados7d}</DataCell>
        <DataCell>{exp.convocatorias7d}</DataCell>
        <DataCell>
          <span 
            className={"inline-block px-1.5 py-0.5 rounded text-[10px] font-medium " + colorCalidad(exp.calidadDato)}
            title={tooltipCalidad()}
          >
            {labelCalidad(exp.calidadDato)}
          </span>
        </DataCell>
      </>
    )
  }

  if (modo === "compacto") {
    return (
      <div className="flex flex-col gap-1 mt-1">
        <span 
          className={"inline-block px-1.5 py-0.5 rounded text-[9px] font-medium w-fit " + colorCalidad(exp.calidadDato)}
          title={tooltipCalidad()}
        >
          {labelCalidad(exp.calidadDato)}
        </span>
        {exp.calidadDato !== "sin_registros_competitivos" && exp.calidadDato !== "insuficiente" && (
          <div className="flex items-center gap-2 text-[9px] font-medium text-surface-600">
            <span>{exp.minutos7d ?? "�"} min / {exp.convocatorias7d} conv.</span>
            {exp.ratioCambioExposicion !== null && (
              <span title="Compara los minutos de los �ltimos 7 d�as con la media semanal de los �ltimos 28 d�as. Es un indicador descriptivo, no una predicci�n de riesgo.">
                Ratio: {exp.ratioCambioExposicion.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-surface-700">Exposici�n competitiva</h3>
        <span 
          className={"px-2 py-0.5 rounded text-[10px] font-medium cursor-help " + colorCalidad(exp.calidadDato)}
          title={tooltipCalidad()}
        >
          {labelCalidad(exp.calidadDato)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-surface-500">Minutos (7d / 28d)</span>
          <span className="text-sm font-semibold text-surface-800">
            {exp.minutos7d ?? "�"} / {exp.minutos28d ?? "�"}
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

        {exp.porcentajeExposicion7d !== null && (
          <div className="flex items-center justify-between pt-2 border-t border-surface-100">
            <span className="text-[10px] text-surface-500">% Exposici�n (7d)</span>
            <span className="text-xs font-semibold text-primary-700">
              {Math.round(exp.porcentajeExposicion7d)}%
            </span>
          </div>
        )}

        {exp.referenciaSemanal28d !== null && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-surface-500">Referencia 28d</span>
            <span className="text-xs font-medium text-surface-700">
              {Math.round(exp.referenciaSemanal28d)} min/sem
            </span>
          </div>
        )}

        {exp.ratioCambioExposicion !== null && (
          <div className="flex items-center justify-between">
            <span 
              className="text-[10px] text-surface-500 cursor-help border-b border-dashed border-surface-300"
              title="Compara los minutos de los �ltimos 7 d�as con la media semanal de los �ltimos 28 d�as. Es un indicador descriptivo, no una predicci�n de riesgo."
            >
              Ratio de cambio
            </span>
            <span className="text-xs font-semibold text-primary-700">
              {exp.ratioCambioExposicion.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}