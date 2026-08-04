import { describe, it, expect } from 'vitest'
import { parsearChronojumpCMJCsv } from './chronojumpParser'
import fs from 'fs'
import path from 'path'

describe('Chronojump CMJ CSV Parser (T-04B)', () => {
  const fixturePath = path.resolve(__dirname, '../../test/fixtures/SIMULATED_jumps_2023-2-27.csv')
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8')

  it('1. Detecta correctamente la sección "+ SALTOS SIMPLES" y extrae 6 filas CMJ del fixture', () => {
    const res = parsearChronojumpCMJCsv(fixtureContent)

    expect(res.exito).toBe(true)
    expect(res.totalFilasSaltosSimples).toBe(6)
    expect(res.totalCMJ).toBe(6)
    expect(res.filasValidas.length).toBe(6)
    expect(res.filasConError.length).toBe(0)
    expect(res.filasOmitidas.length).toBe(0)
  })

  it('2. Normaliza coma decimal en altura y tiempo de vuelo a ms', () => {
    const res = parsearChronojumpCMJCsv(fixtureContent)

    // Fila 1 del fixture: Altura "40,068" -> 40.068, TV "0,572" -> 572 ms
    const fila1 = res.filasValidas.find((f) => f.idSaltoChronojump === '1')
    expect(fila1).toBeDefined()
    expect(fila1?.alturaSaltoCm).toBe(40.068)
    expect(fila1?.tiempoVueloMs).toBe(572)

    // Fila 2 del fixture (salto ID 5): Altura "55,103" -> 55.103, TV "0,67" -> 670 ms
    const fila2 = res.filasValidas.find((f) => f.idSaltoChronojump === '5')
    expect(fila2).toBeDefined()
    expect(fila2?.alturaSaltoCm).toBe(55.103)
    expect(fila2?.tiempoVueloMs).toBe(670)
  })

  it('3. Deriva los intentos por hora ascendente para cada sujeto', () => {
    const res = parsearChronojumpCMJCsv(fixtureContent)

    // Sujeto 1 ("bdfbd bdbd"): 3 saltos a las 18:29:23 (ID 1), 18:31:05 (ID 5), 18:31:07 (ID 6)
    const saltosSujeto1 = res.filasValidas
      .filter((f) => f.aliasOrigen === 'bdfbd bdbd')
      .sort((a, b) => a.intento - b.intento)

    expect(saltosSujeto1.length).toBe(3)
    expect(saltosSujeto1[0].idSaltoChronojump).toBe('1')
    expect(saltosSujeto1[0].intento).toBe(1)
    expect(saltosSujeto1[1].idSaltoChronojump).toBe('5')
    expect(saltosSujeto1[1].intento).toBe(2)
    expect(saltosSujeto1[2].idSaltoChronojump).toBe('6')
    expect(saltosSujeto1[2].intento).toBe(3)

    // Sujeto 2 ("fdbfdvs vasvsava"): 3 saltos a las 18:30:49 (ID 2), 18:30:57 (ID 3), 18:31:00 (ID 4)
    const saltosSujeto2 = res.filasValidas
      .filter((f) => f.aliasOrigen === 'fdbfdvs vasvsava')
      .sort((a, b) => a.intento - b.intento)

    expect(saltosSujeto2.length).toBe(3)
    expect(saltosSujeto2[0].idSaltoChronojump).toBe('2')
    expect(saltosSujeto2[0].intento).toBe(1)
    expect(saltosSujeto2[1].idSaltoChronojump).toBe('3')
    expect(saltosSujeto2[1].intento).toBe(2)
    expect(saltosSujeto2[2].idSaltoChronojump).toBe('4')
    expect(saltosSujeto2[2].intento).toBe(3)
  })

  it('4. Informa filas omitidas de otros tipos de salto (ej. SJ, DJ)', () => {
    const csvConOtrosTipos = `
+ SALTOS SIMPLES

ID de la persona;Nombre de la persona;ID de sesión;ID de salto;Tipo;TC;TV;Caída;Peso kg;Altura;Potencia;Fórmula de la potencia;Rigidez;Velocidad inicial;RSI;Fecha;Tiempo;Descripción;Simulado
1;CJ-01;1;1;CMJ;0;0,572;0;0;40,068;686;Lewis;0;2.8;0;2026-08-02;18:29:23;;Sí
1;CJ-01;1;2;SJ;0;0,510;0;0;32,100;600;Lewis;0;2.5;0;2026-08-02;18:30:00;;Sí
`
    const res = parsearChronojumpCMJCsv(csvConOtrosTipos)

    expect(res.exito).toBe(true)
    expect(res.totalFilasSaltosSimples).toBe(2)
    expect(res.totalCMJ).toBe(1)
    expect(res.filasValidas.length).toBe(1)
    expect(res.filasOmitidas.length).toBe(1)
    expect(res.filasOmitidas[0].tipo).toBe('SJ')
  })

  it('5. Rechaza archivo sin sección de saltos simples o sin cabeceras requeridas', () => {
    const csvInvalido = `+ SESIÓN\n1;SIMULATED;;27/02/2023;`
    const res1 = parsearChronojumpCMJCsv(csvInvalido)
    expect(res1.exito).toBe(false)
    expect(res1.mensajeGlobal).toContain('No se encontró la sección "+ SALTOS SIMPLES"')

    const csvCabeceraIncompleta = `
+ SALTOS SIMPLES

ID de la persona;Nombre de la persona;ID de salto;Tipo
1;CJ-01;1;CMJ
`
    const res2 = parsearChronojumpCMJCsv(csvCabeceraIncompleta)
    expect(res2.exito).toBe(false)
    expect(res2.mensajeGlobal).toContain('carece de la columna obligatoria')
  })

  it('6. Detecta errores en filas con fecha o altura inválida', () => {
    const csvConErrores = `
+ SALTOS SIMPLES

ID de la persona;Nombre de la persona;ID de sesión;ID de salto;Tipo;TC;TV;Caída;Peso kg;Altura;Potencia;Fórmula de la potencia;Rigidez;Velocidad inicial;RSI;Fecha;Tiempo;Descripción;Simulado
1;CJ-01;1;1;CMJ;0;0,572;0;0;0;686;Lewis;0;2.8;0;2026-08-02;18:29:23;;Sí
1;CJ-01;1;2;CMJ;0;0,572;0;0;40,0;686;Lewis;0;2.8;0;02/08/2026;18:30:00;;Sí
`
    const res = parsearChronojumpCMJCsv(csvConErrores)
    expect(res.exito).toBe(true)
    expect(res.filasConError.length).toBe(2)
    expect(res.filasConError[0].motivo).toContain('Altura de salto inválida')
    expect(res.filasConError[1].motivo).toContain('Fecha local estricta inválida')
  })
})
