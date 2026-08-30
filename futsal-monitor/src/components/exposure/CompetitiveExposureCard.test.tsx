import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { CompetitiveExposureCard } from "./CompetitiveExposureCard"
import * as matchExposure from "@/domain/exposure/matchExposure"

vi.mock("@/domain/exposure/matchExposure", () => ({
  calcularExposicionCompetitiva: vi.fn()
}))

describe("CompetitiveExposureCard", () => {
  const mockCalcular = vi.mocked(matchExposure.calcularExposicionCompetitiva)

  beforeEach(() => {
    mockCalcular.mockReset()
  })

  it("1. Usa calcularExposicionCompetitiva del dominio sin duplicar logica", () => {
    mockCalcular.mockReturnValue({
      minutos7d: 30, minutos28d: 120,
      partidosJugados7d: 1, partidosJugados28d: 4,
      convocatorias7d: 1, convocatorias28d: 4,
      convocadaSinMinutos7d: 0, convocadaSinMinutos28d: 0,
      porcentajeExposicion7d: 75,
      referenciaSemanal28d: 30,
      ratioCambioExposicion: 1.0,
      calidadDato: "completa",
      motivosCalidadDato: []
    })

    render(<CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="completo" />)
    expect(mockCalcular).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Completa")).toBeInTheDocument()
    expect(screen.getByText("30 / 120")).toBeInTheDocument()
    expect(screen.queryByText(/riesgo elevado/i)).not.toBeInTheDocument()
  })

  it("2. Muestra � cuando ratio o referencia no son calculables", () => {
    mockCalcular.mockReturnValue({
      minutos7d: null, minutos28d: null,
      partidosJugados7d: 0, partidosJugados28d: 0,
      convocatorias7d: 0, convocatorias28d: 0,
      convocadaSinMinutos7d: 0, convocadaSinMinutos28d: 0,
      porcentajeExposicion7d: null,
      referenciaSemanal28d: null,
      ratioCambioExposicion: null,
      calidadDato: "sin_registros_competitivos",
      motivosCalidadDato: []
    })

    render(<CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="completo" />)
    expect(screen.getByText("� / �")).toBeInTheDocument()
    expect(screen.getByText("Sin registros competitivos")).toBeInTheDocument()
    expect(screen.queryByText("Ratio de cambio")).not.toBeInTheDocument()
  })

  it("3. Modo fila renderiza las celdas correctamente", () => {
    mockCalcular.mockReturnValue({
      minutos7d: 40, minutos28d: 40,
      partidosJugados7d: 1, partidosJugados28d: 1,
      convocatorias7d: 1, convocatorias28d: 1,
      convocadaSinMinutos7d: 0, convocadaSinMinutos28d: 0,
      porcentajeExposicion7d: 100,
      referenciaSemanal28d: 10,
      ratioCambioExposicion: 4.0,
      calidadDato: "parcial",
      motivosCalidadDato: []
    })

    render(
      <table>
        <tbody>
          <tr>
            <CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="fila" />
          </tr>
        </tbody>
      </table>
    )

    expect(screen.getByText("40")).toBeInTheDocument()
    expect(screen.getByText("Parcial")).toBeInTheDocument()
  })

  it("4. Modo compacto renderiza sin alertas", () => {
    mockCalcular.mockReturnValue({
      minutos7d: 40, minutos28d: 40,
      partidosJugados7d: 1, partidosJugados28d: 1,
      convocatorias7d: 1, convocatorias28d: 1,
      convocadaSinMinutos7d: 0, convocadaSinMinutos28d: 0,
      porcentajeExposicion7d: 100,
      referenciaSemanal28d: 10,
      ratioCambioExposicion: 4.0,
      calidadDato: "completa",
      motivosCalidadDato: []
    })

    render(<CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="compacto" />)
    expect(screen.getByText("Completa")).toBeInTheDocument()
    expect(screen.getByText("40 min / 1 conv.")).toBeInTheDocument()
    expect(screen.getByText("Ratio: 4.00")).toBeInTheDocument()
  })

  it("5. Tooltip accesible responde al foco y escape", () => {
    mockCalcular.mockReturnValue({
      minutos7d: 40, minutos28d: 40,
      partidosJugados7d: 1, partidosJugados28d: 1,
      convocatorias7d: 1, convocatorias28d: 1,
      convocadaSinMinutos7d: 0, convocadaSinMinutos28d: 0,
      porcentajeExposicion7d: 100,
      referenciaSemanal28d: 10,
      ratioCambioExposicion: 4.0,
      calidadDato: "insuficiente",
      motivosCalidadDato: []
    })

    render(<CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="completo" />)

    const trigger = screen.getByText("Datos competitivos incompletos")
    expect(trigger).toHaveAttribute("aria-describedby")
    expect(trigger).toHaveAttribute("tabIndex", "0")

    const tooltipId = trigger.getAttribute("aria-describedby")
    const tooltip = document.getElementById(tooltipId)
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveAttribute("role", "tooltip")

    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    fireEvent.keyDown(trigger, { key: "Escape", code: "Escape" })
    expect(document.activeElement).not.toBe(trigger)
  })
})
