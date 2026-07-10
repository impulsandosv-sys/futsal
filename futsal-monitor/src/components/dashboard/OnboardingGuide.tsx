import { useState, useEffect } from 'react'
import { useStore } from '@/store/store'

const ONBOARDING_KEY = 'futsal_onboarding_done'

const steps = [
  {
    title: 'Bienvenido a Futsal Monitor',
    text: 'Tu herramienta central para monitorizar la preparación física del equipo. Los datos se guardan localmente en tu navegador.',
  },
  {
    title: 'Empieza por cargar datos',
    text: 'Ve a "Importar" y carga datos de demostración para explorar la app, o importa un CSV/Excel desde Google Forms.',
  },
  {
    title: 'Registra jugadoras',
    text: 'Cada jugadora tiene un ID único que vincula todos sus datos. Mantén este ID consistente en todos los formularios.',
  },
  {
    title: 'Wellness diario',
    text: 'Las jugadoras envían su wellness mediante un formulario externo. Tú lo importas y visualizas aquí.',
  },
  {
    title: 'Alertas automáticas',
    text: 'La app detecta wellness bajo, carga excesiva, lesiones activas y datos faltantes. Revisa las alertas a diario.',
  },
]

export function OnboardingGuide() {
  const { hasData } = useStore()
  const [dismissed, setDismissed] = useState(true)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY)
    if (!done && !hasData) {
      setDismissed(false)
    }
  }, [hasData])

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(ONBOARDING_KEY, 'true')
  }

  if (dismissed) return null

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded">
            Paso {step + 1}/{steps.length}
          </span>
          <h3 className="text-xs font-semibold text-primary-800">{current.title}</h3>
        </div>
        <button onClick={dismiss} className="text-primary-400 hover:text-primary-600 text-sm leading-none">&times;</button>
      </div>
      <p className="text-[11px] text-primary-700 mb-3">{current.text}</p>
      <div className="flex items-center gap-2">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="text-[10px] text-primary-600 hover:text-primary-800 px-2 py-1"
          >
            Anterior
          </button>
        )}
        <button
          onClick={() => isLast ? dismiss() : setStep(step + 1)}
          className="text-[10px] bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700"
        >
          {isLast ? 'Entendido' : 'Siguiente'}
        </button>
        <button
          onClick={dismiss}
          className="text-[10px] text-primary-400 hover:text-primary-600 px-2 py-1 ml-auto"
        >
          Saltar tour
        </button>
      </div>
    </div>
  )
}
