const BLOCKED_PATTERNS = [
  // Gewalt
  /\b(töten|mord|waffe|messer|pistole|bombe|explosion|blut|schlagen|sterben|tod)\b/gi,
  // Drogen
  /\b(drogen|kokain|heroin|cannabis|weed|rauchen|alkohol|saufen)\b/gi,
  // Sexuell
  /\b(sex|nackt|porno|erotik)\b/gi,
  // Selbstverletzung
  /\b(suizid|selbstverletzung|schneiden|hungern)\b/gi,
  // Extremismus
  /\b(nazi|hitler|terrorismus|extremismus|hass)\b/gi,
]

export interface ContentCheckResult {
  safe: boolean
  reason?: string
}

export function checkContent(text: string): ContentCheckResult {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: 'Dieser Inhalt ist für Schüler nicht geeignet. Bitte gib Schul-Lernstoff ein.'
      }
    }
  }
  if (text.trim().length < 80) {
    return {
      safe: false,
      reason: 'Bitte gib mindestens 80 Zeichen ein für gute Lernfragen.'
    }
  }
  return { safe: true }
}
