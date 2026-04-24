'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { supabase, type Restaurant } from '@/lib/supabase'

type RoundSize = 4 | 8 | 16
type GameState = 'intro' | 'loading' | 'playing' | 'result'
type CardState = 'idle' | 'winner' | 'loser'

const CATEGORIES = [
  { key: '점심', emoji: '🍱', label: '점심' },
  { key: '회식', emoji: '🍻', label: '회식' },
  { key: '디저트', emoji: '🍰', label: '디저트' },
]

const ROUND_OPTIONS: { size: RoundSize; label: string; desc: string }[] = [
  { size: 4,  label: '4강',  desc: '4개 맛집, 빠르게!' },
  { size: 8,  label: '8강',  desc: '8개 맛집, 적당히' },
  { size: 16, label: '16강', desc: '16개 맛집, 정석대로' },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getRoundName(remaining: number): string {
  if (remaining === 16) return '16강'
  if (remaining === 8) return '8강'
  if (remaining === 4) return '4강'
  if (remaining === 2) return '결승'
  return ''
}

function getTotalMatches(roundSize: RoundSize): number {
  return roundSize - 1
}

function getCompletedMatches(roundSize: RoundSize, totalInRound: number, currentMatch: number): number {
  const prevMap16: Record<number, number> = { 16: 0, 8: 8, 4: 12, 2: 14 }
  const prevMap8: Record<number, number>  = { 8: 0, 4: 4, 2: 6 }
  const prevMap4: Record<number, number>  = { 4: 0, 2: 2 }
  const map = roundSize === 16 ? prevMap16 : roundSize === 8 ? prevMap8 : prevMap4
  return (map[totalInRound] ?? 0) + currentMatch - 1
}

function RestaurantCard({
  restaurant,
  onSelect,
  state,
}: {
  restaurant: Restaurant
  onSelect: () => void
  state: CardState
}) {
  return (
    <button
      onClick={onSelect}
      disabled={state !== 'idle'}
      className={[
        'w-full flex-1 text-left rounded-3xl p-6 shadow-lg transition-all duration-300 border-2',
        state === 'idle'
          ? 'bg-white dark:bg-gray-800 border-transparent hover:border-orange-400 hover:shadow-2xl hover:scale-105 cursor-pointer'
          : state === 'winner'
            ? 'bg-gradient-to-br from-orange-400 to-amber-400 dark:from-orange-600 dark:to-amber-600 border-orange-500 scale-105 shadow-2xl cursor-default'
            : 'bg-gray-100 dark:bg-gray-900 border-transparent opacity-40 scale-95 cursor-default',
      ].join(' ')}
    >
      <div className="space-y-3">
        <div className={`text-2xl font-extrabold ${state === 'winner' ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
          {state === 'winner' && <span className="mr-2">✅</span>}
          {restaurant.name}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            state === 'winner'
              ? 'bg-white/30 text-white'
              : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
          }`}>
            {restaurant.genre}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            state === 'winner'
              ? 'bg-white/30 text-white'
              : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
          }`}>
            📍 {restaurant.location ?? '판교'}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            state === 'winner'
              ? 'bg-white/20 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            {CATEGORIES.find(c => c.key === restaurant.category)?.emoji} {restaurant.category}
          </span>
        </div>
        {restaurant.review && (
          <p className={`text-sm leading-relaxed line-clamp-2 ${
            state === 'winner' ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {restaurant.review}
          </p>
        )}
      </div>
    </button>
  )
}

export default function Home() {
  const { theme, toggle } = useTheme()

  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(['점심', '회식', '디저트'])
  )
  const [gameState, setGameState] = useState<GameState>('intro')
  const [roundSize, setRoundSize] = useState<RoundSize>(16)
  const [contestants, setContestants] = useState<Restaurant[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [winners, setWinners] = useState<Restaurant[]>([])
  const [champion, setChampion] = useState<Restaurant | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 선택된 카테고리에 맞는 맛집 필터링
  const filteredRestaurants = useMemo(
    () => allRestaurants.filter(r => selectedCategories.has(r.category)),
    [allRestaurants, selectedCategories]
  )

  // Supabase에서 전체 로드
  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*')
      .in('category', ['점심', '회식', '디저트'])
      .then(({ data, error }) => {
        if (error) {
          setError('맛집 데이터를 불러오지 못했습니다.')
          return
        }
        setAllRestaurants(data ?? [])
      })
  }, [])

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) {
        if (next.size === 1) return prev // 최소 1개는 선택 유지
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
    setError(null)
  }, [])

  const totalInRound = contestants.length
  const matchesInRound = totalInRound / 2
  const currentMatch = Math.floor(currentIndex / 2) + 1
  const totalMatches = getTotalMatches(roundSize)
  const completedMatches = getCompletedMatches(roundSize, totalInRound, currentMatch)
  const progress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0

  const startGame = useCallback((size: RoundSize) => {
    if (filteredRestaurants.length < size) {
      setError(`선택한 카테고리에 맛집이 ${size}개 이상 필요합니다. (현재 ${filteredRestaurants.length}개)`)
      return
    }
    setGameState('loading')
    setTimeout(() => {
      const shuffled = shuffle(filteredRestaurants).slice(0, size)
      setRoundSize(size)
      setContestants(shuffled)
      setCurrentIndex(0)
      setWinners([])
      setChampion(null)
      setSelected(null)
      setError(null)
      setGameState('playing')
    }, 300)
  }, [filteredRestaurants])

  const handleSelect = useCallback((winner: Restaurant) => {
    if (selected !== null) return
    setSelected(winner.id)

    setTimeout(() => {
      const newWinners = [...winners, winner]
      const nextIndex = currentIndex + 2

      if (nextIndex >= contestants.length) {
        if (newWinners.length === 1) {
          setChampion(newWinners[0])
          setGameState('result')
        } else {
          setContestants(newWinners)
          setCurrentIndex(0)
          setWinners([])
        }
      } else {
        setCurrentIndex(nextIndex)
        setWinners(newWinners)
      }
      setSelected(null)
    }, 600)
  }, [selected, winners, currentIndex, contestants])

  const left = contestants[currentIndex]
  const right = contestants[currentIndex + 1]

  // 카테고리별 개수
  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    allRestaurants.forEach(r => {
      map[r.category] = (map[r.category] ?? 0) + 1
    })
    return map
  }, [allRestaurants])

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-300">

      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
          🍱 판교 맛집 월드컵
        </span>
        <button
          onClick={toggle}
          className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow text-lg"
          aria-label="테마 전환"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>

      <main className="flex flex-col items-center justify-center px-4 pb-16">

        {error && (
          <div className="mt-4 px-4 py-3 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-xl text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ── 시작 화면 ── */}
        {gameState === 'intro' && (
          <div className="text-center mt-10 space-y-7 max-w-lg w-full">
            <div className="space-y-3">
              <div className="text-7xl">🏆</div>
              <h1 className="text-4xl font-extrabold text-gray-800 dark:text-gray-100">
                판교 맛집 월드컵
              </h1>
              <p className="text-base text-gray-400 dark:text-gray-500">
                랜덤으로 뽑아 최고의 판교 맛집을 가려보세요!
              </p>
            </div>

            {/* 카테고리 선택 */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">카테고리 선택</p>
              <div className="grid grid-cols-3 gap-3">
                {CATEGORIES.map(({ key, emoji, label }) => {
                  const isOn = selectedCategories.has(key)
                  const count = countByCategory[key] ?? 0
                  return (
                    <button
                      key={key}
                      onClick={() => toggleCategory(key)}
                      className={[
                        'flex flex-col items-center gap-1 p-4 rounded-2xl border-2 font-bold transition-all duration-200',
                        isOn
                          ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-105'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-orange-300',
                      ].join(' ')}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className="text-sm">{label}</span>
                      <span className={`text-xs font-normal ${isOn ? 'text-white/80' : 'text-gray-400'}`}>
                        {count}개
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className={`text-xs transition-colors ${filteredRestaurants.length > 0 ? 'text-gray-400 dark:text-gray-500' : 'text-red-400'}`}>
                선택된 맛집 총 <span className="font-bold text-orange-500">{filteredRestaurants.length}개</span>
              </p>
            </div>

            {/* 라운드 선택 */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">라운드 선택</p>
              <div className="grid grid-cols-3 gap-3">
                {ROUND_OPTIONS.map(({ size, label, desc }) => {
                  const disabled = filteredRestaurants.length < size || allRestaurants.length === 0
                  return (
                    <button
                      key={size}
                      onClick={() => startGame(size)}
                      disabled={disabled}
                      className={[
                        'flex flex-col items-center gap-1 p-4 rounded-2xl border-2 font-bold transition-all duration-200',
                        disabled
                          ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                          : 'border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800 hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:scale-105 shadow-sm hover:shadow-lg cursor-pointer',
                      ].join(' ')}
                    >
                      <span className="text-2xl">{label}</span>
                      <span className="text-xs font-normal opacity-75">{desc}</span>
                      {disabled && allRestaurants.length > 0 && (
                        <span className="text-xs font-normal text-red-400">({size}개 필요)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {allRestaurants.length === 0 && !error && (
              <p className="text-gray-400 dark:text-gray-600 text-sm animate-pulse">맛집 불러오는 중...</p>
            )}
          </div>
        )}

        {/* ── 로딩 ── */}
        {gameState === 'loading' && (
          <div className="mt-32 text-center space-y-4">
            <div className="text-5xl animate-spin">⚙️</div>
            <p className="text-gray-500 dark:text-gray-400">대진표 생성 중...</p>
          </div>
        )}

        {/* ── 게임 화면 ── */}
        {gameState === 'playing' && left && right && (
          <div className="w-full max-w-4xl mt-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <span className="px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded-full">
                  {getRoundName(totalInRound)}
                </span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  {currentMatch}경기 / {matchesInRound}경기
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-500 to-amber-400 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                더 먹고 싶은 곳을 선택하세요!
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-6">
              <RestaurantCard
                restaurant={left}
                onSelect={() => handleSelect(left)}
                state={selected === null ? 'idle' : selected === left.id ? 'winner' : 'loser'}
              />
              <div className="flex items-center justify-center flex-shrink-0">
                <span className="text-3xl font-black text-gray-400 dark:text-gray-600">VS</span>
              </div>
              <RestaurantCard
                restaurant={right}
                onSelect={() => handleSelect(right)}
                state={selected === null ? 'idle' : selected === right.id ? 'winner' : 'loser'}
              />
            </div>
          </div>
        )}

        {/* ── 결과 화면 ── */}
        {gameState === 'result' && champion && (
          <div className="text-center mt-10 space-y-8 max-w-lg w-full">
            <div className="space-y-2">
              <div className="text-6xl animate-bounce">🏆</div>
              <h2 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">
                오늘의 선택!
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                당신이 고른 최고의 판교 맛집
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40 rounded-3xl p-8 shadow-xl border border-orange-200 dark:border-orange-800 space-y-4">
              <div className="text-4xl font-black text-orange-600 dark:text-orange-400">
                {champion.name}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-orange-500 text-white text-sm rounded-full font-medium">
                  {champion.genre}
                </span>
                <span className="px-3 py-1 bg-amber-500 text-white text-sm rounded-full font-medium">
                  📍 {champion.location ?? '판교'}
                </span>
                <span className="px-3 py-1 bg-gray-400 text-white text-sm rounded-full font-medium">
                  {CATEGORIES.find(c => c.key === champion.category)?.emoji} {champion.category}
                </span>
              </div>
              {champion.review && (
                <p className="text-gray-700 dark:text-gray-300 italic text-sm leading-relaxed">
                  &ldquo;{champion.review}&rdquo;
                </p>
              )}
              {champion.link && (
                <a
                  href={champion.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl shadow transition-colors"
                >
                  🗺️ 지도에서 보기
                </a>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">한 번 더?</p>
              <div className="flex justify-center gap-3">
                {ROUND_OPTIONS.map(({ size, label }) => (
                  <button
                    key={size}
                    onClick={() => startGame(size)}
                    disabled={filteredRestaurants.length < size}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-200 text-sm"
                  >
                    🔄 {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setGameState('intro')}
                className="text-sm text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 underline"
              >
                처음으로 돌아가기
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
