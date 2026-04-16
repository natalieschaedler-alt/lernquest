/**
 * StreakHeatmap – 30-Tage GitHub-Heatmap der Lernaktivität.
 *
 * Jedes Quadrat steht für einen Tag.
 * Intensitätsstufen:
 *   0 = grau  (kein Activity)
 *   1 = lila  (1-4 Fragen)
 *   2 = violett (5+ Fragen, aktiver Tag)
 *   3 = leuchtendes Violett (Dungeon abgeschlossen)
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStreak, lastNDays, activityLevel } from '../../hooks/useStreak'

const LEVEL_COLORS = [
  'rgba(255,255,255,0.06)',  // 0 – inactive
  '#3B1F6B',                  // 1 – some questions
  '#6C3CE1',                  // 2 – active (5+ questions)
  '#9B5DE5',                  // 3 – dungeon completed
] as const

const DAYS = 30
const COLS = 10   // 3 rows × 10 cols = 30 days
const ROWS = 3

export default function StreakHeatmap() {
  const { t } = useTranslation()
  const { activityDays, streak, longestStreak } = useStreak()

  const days = useMemo(() => lastNDays(DAYS), [])

  // Group into rows (oldest days first, top-left)
  const grid = useMemo(() => {
    const result: Array<Array<{ date: string; level: 0 | 1 | 2 | 3 }>> = []
    for (let row = 0; row < ROWS; row++) {
      const rowData = []
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col
        const date = days[idx]
        const level = activityLevel(date ? activityDays[date] : undefined)
        rowData.push({ date: date ?? '', level })
      }
      result.push(rowData)
    }
    return result
  }, [days, activityDays])

  const todayStr = days[days.length - 1]

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-gray-400 uppercase tracking-wider">
          {t('streak.heatmap_title')}
        </h3>
        <div className="flex items-center gap-1.5">
          {([0, 1, 2, 3] as const).map((lvl) => (
            <div
              key={lvl}
              className="w-3 h-3 rounded-sm"
              style={{ background: LEVEL_COLORS[lvl], border: lvl === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}
            />
          ))}
        </div>
      </div>

      {/* Grid */}
      <div
        className="bg-dark-card rounded-2xl p-4 border border-dark-border"
        style={{ overflowX: 'auto' }}
      >
        <div className="flex flex-col gap-1.5" style={{ minWidth: 200 }}>
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1.5">
              {row.map(({ date, level }) => {
                const isToday = date === todayStr
                return (
                  <div
                    key={date}
                    title={date ? new Date(date).toLocaleDateString() : ''}
                    className="flex-1 rounded-sm"
                    style={{
                      aspectRatio:  '1',
                      background:   LEVEL_COLORS[level],
                      border:       isToday
                        ? '1.5px solid rgba(155,93,229,0.8)'
                        : level === 0
                        ? '1px solid rgba(255,255,255,0.05)'
                        : 'none',
                      minWidth:     20,
                      transition:   'background 0.2s',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Axis labels: first day … last day */}
        <div className="flex justify-between mt-2 px-0.5">
          <span className="font-body text-xs text-gray-600">
            {days[0] ? new Date(days[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
          </span>
          <span className="font-body text-xs text-gray-600">
            {t('streak.heatmap_today')}
          </span>
        </div>
      </div>

      {/* Streak summary */}
      <div className="flex gap-2.5">
        <div
          className="flex-1 bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex flex-col items-center gap-0.5"
        >
          <span className="text-xl">🔥</span>
          <span className="font-display text-lg text-white">{streak}</span>
          <span className="font-body text-xs text-gray-500 text-center">{t('streak.heatmap_current')}</span>
        </div>
        <div
          className="flex-1 bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex flex-col items-center gap-0.5"
        >
          <span className="text-xl">🏆</span>
          <span className="font-display text-lg text-white">{longestStreak}</span>
          <span className="font-body text-xs text-gray-500 text-center">{t('streak.heatmap_longest')}</span>
        </div>
      </div>
    </div>
  )
}
