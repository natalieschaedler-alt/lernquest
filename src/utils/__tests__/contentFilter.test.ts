import { describe, it, expect } from 'vitest'
import { checkContent } from '../contentFilter'

describe('checkContent', () => {
  it('blockiert Gewalt-Keywords', () => {
    const result = checkContent(
      'In dieser langen Geschichte geht es darum wie man Menschen töten kann und was dabei passiert wenn man das tut'
    )
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('Schüler')
  })

  it('blockiert Drogen-Keywords', () => {
    const result = checkContent(
      'In diesem sehr langen Text wird beschrieben wie Kokain hergestellt wird und welche Auswirkungen es auf den Körper hat'
    )
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('Schüler')
  })

  it('blockiert sexuelle Keywords', () => {
    const result = checkContent(
      'Dieser sehr lange Text enthält explizite Sex Inhalte die für Minderjährige absolut nicht geeignet sind und gefiltert werden müssen'
    )
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('Schüler')
  })

  it('blockiert Selbstverletzungs-Keywords', () => {
    const result = checkContent(
      'In diesem langen Absatz wird über Suizid und Selbstverletzung gesprochen was in Schultexten nicht vorkommen sollte'
    )
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('Schüler')
  })

  it('blockiert Extremismus-Keywords', () => {
    const result = checkContent(
      'Dieser lange Text handelt von Hitler und Nazi Ideologie sowie Terrorismus und Extremismus in der modernen Welt'
    )
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('Schüler')
  })

  it('lehnt Texte unter 80 Zeichen ab', () => {
    const result = checkContent('Kurzer Text')
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('80')
  })

  it('akzeptiert validen Lerninhalt', () => {
    const result = checkContent(
      'Die Photosynthese ist ein biochemischer Prozess, durch den grüne Pflanzen mithilfe von Lichtenergie aus Kohlenstoffdioxid und Wasser energiereiche organische Verbindungen herstellen.'
    )
    expect(result.safe).toBe(true)
    expect(result.reason).toBeUndefined()
  })
})
