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

  it("1. completa: métricas reales visibles", () => {
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
    expect(screen.getAllByText("30 / 120").length).toBeGreaterThan(0)
    expect(screen.getAllByText("1 / 4").length).toBeGreaterThan(0) // Partidos
  })

  it("2. parcial: métricas reales visibles y etiqueta Parcial", () => {
    mockCalcular.mockReturnValue({
      minutos7d: 20, minutos28d: 40,
      partidosJugados7d: 1, partidosJugados28d: 2,
      convocatorias7d: 1, convocatorias28d: 2,
      convocadaSinMinutos7d: 0, convocadaSinMinutos28d: 0,
      porcentajeExposicion7d: 50,
      referenciaSemanal28d: 10,
      ratioCambioExposicion: 2.0,
      calidadDato: "parcial",
      motivosCalidadDato: []
    })

    render(<CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="completo" />)
    expect(screen.getByText("Parcial")).toBeInTheDocument()
    expect(screen.getAllByText("20 / 40").length).toBeGreaterThan(0)
  })

  it("3. insuficiente: no muestra 0 / 0 ni 0 min / 0 conv.; muestra “", () => {
    mockCalcular.mockReturnValue({
      minutos7d: 0, minutos28d: 0,
      partidosJugados7d: 0, partidosJugados28d: 0,
      convocatorias7d: 0, convocatorias28d: 0,
      convocadaSinMinutos7d: 0, convocadaSinMinutos28d: 0,
      porcentajeExposicion7d: null,
      referenciaSemanal28d: null,
      ratioCambioExposicion: null,
      calidadDato: "insuficiente",
      motivosCalidadDato: []
    })

    const { unmount } = render(<CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="completo" />)
    expect(screen.getAllByText("“ / “").length).toBeGreaterThan(0)
    expect(screen.queryByText("0 / 0")).toBeNull();
    expect(screen.queryByText("0 min / 0 conv.")).toBeNull();

    unmount()
    render(<CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="compacto" />)
    expect(screen.queryByText("0 min / 0 conv.")).toBeNull();
  })

  it("4. sin_registros_competitivos: muestra Sin registros competitivos y “", () => {
    mockCalcular.mockReturnValue({
      minutos7d: 0, minutos28d: 0,
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
    expect(screen.getByText("Sin registros competitivos")).toBeInTheDocument()
    expect(screen.getAllByText("“ / “").length).toBeGreaterThan(0)
    expect(screen.queryByText("0 / 0")).toBeNull();
  })

  it("5. convocada_sin_minutos válida: 0 minutos visible como dato real, 1 convocatoria", () => {
    mockCalcular.mockReturnValue({
      minutos7d: 0, minutos28d: 0,
      partidosJugados7d: 0, partidosJugados28d: 0,
      convocatorias7d: 1, convocatorias28d: 1,
      convocadaSinMinutos7d: 1, convocadaSinMinutos28d: 1,
      porcentajeExposicion7d: 0,
      referenciaSemanal28d: 0,
      ratioCambioExposicion: null,
      calidadDato: "completa",
      motivosCalidadDato: []
    })

    render(<CompetitiveExposureCard registros={[]} fechaCorteISO="2026-08-01" modo="completo" />)
    expect(screen.getByText("Completa")).toBeInTheDocument()
    // Como es de calidad completa, sí muestra los 0 reales.
    expect(screen.getAllByText("0 / 0").length).toBeGreaterThan(0) // Minutos y Partidos (habrá bastantes)
    expect(screen.getAllByText("1 / 1").length).toBeGreaterThan(0) // Convocatorias
  })

  it("6. tooltip accesible: responde al foco y escape", () => {
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
    
    const trigger = screen.getByText("Completa")
    expect(trigger).toHaveAttribute("aria-describedby")
    expect(trigger).toHaveAttribute("tabIndex", "0")
    
    const tooltipId = trigger.getAttribute("aria-describedby")
    const tooltip = document.getElementById(tooltipId!)
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveAttribute("role", "tooltip")

    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    fireEvent.keyDown(trigger, { key: "Escape", code: "Escape" })
    expect(document.activeElement).not.toBe(trigger)
  })

})
