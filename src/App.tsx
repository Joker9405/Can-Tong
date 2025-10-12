import React, { useState, useEffect, useMemo } from 'react'
// 導入詞庫和錄音映射
import lexiconData from '../data/lexicon.json'
import devAudioMap from '../data/devAudioMap.json'

// 詞條類型
interface LexEntry {
  id: string
  intents: string[]
  yue: string
  jyut: string
  /** 表情符號，例如 😊、😢 等 */
  emoji?: string
  /** 情感描述，例如「高興」「難過」 */
  emotion?: string
  note?: string
}

// 熱門短語，用於每日任務
const HOT_PHRASES = [
  '加油',
  '我好開心',
  '幾多錢',
  '太貴啦',
  '好食嗎',
  '我要呢個',
  '點樣走',
  '再見',
  '多謝你幫我',
  '今日落雨',
  '我遲到',
  '對唔住',
  '可唔可以平啲'
]

// 當天日期鍵，用於本地存儲
const todayKey = (): string => {
  return new Date().toISOString().slice(0, 10)
}

// 主組件
const App: React.FC = () => {
  const [inputText, setInputText] = useState('')
  // 翻譯結果，包括表情和情感
  const [output, setOutput] = useState<{
    yue: string
    jyut: string
    emoji?: string
    emotion?: string
    note?: string
  } | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('favorites') || '[]')
    } catch {
      return []
    }
  })
  const [tasks, setTasks] = useState<string[]>([])

  // 加載每日任務
  useEffect(() => {
    const stored = localStorage.getItem('tasks')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.date === todayKey()) {
          setTasks(parsed.items)
          return
        }
      } catch {
        // ignore
      }
    }
    // 隨機選取 5 條短語
    const items = [...HOT_PHRASES].sort(() => Math.random() - 0.5).slice(0, 5)
    setTasks(items)
    localStorage.setItem('tasks', JSON.stringify({ date: todayKey(), items }))
  }, [])

  // 加載聲音列表
  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices())
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  // 選擇可用的粵語聲音
  const zhHKVoice = useMemo(() => {
    return (
      voices.find((v) => /yue|hong\s*kong|zh/i.test(`${v.lang} ${v.name}`)) ||
      voices.find((v) => /zh/i.test(v.lang || ''))
    )
  }, [voices])

  // 規範化文本（小寫、去空格）
  const normalize = (s: string): string => s.trim().toLowerCase()

  // 翻譯核心：根據詞庫匹配輸入
  function translateCore(q: string) {
    const n = normalize(q)
    for (const item of lexiconData as LexEntry[]) {
      if (
        item.intents.some((k) => n === normalize(k) || n.includes(normalize(k)))
      ) {
        return { yue: item.yue, jyut: item.jyut, note: item.note }
      }
    }
    // 未找到時返回提示
    return { yue: '（未收錄，歡迎提交）', jyut: '—', note: undefined }
  }

  // 執行翻譯
  const handleTranslate = () => {
    const result = translateCore(inputText)
    setOutput(result)
  }

  // 播放發音：不再限制權限，預先錄音優先，否則調用瀏覽器 TTS
  const speak = (text: string) => {
    const map: Record<string, string> = devAudioMap as Record<string, string>
    const file = map[text]
    if (file) {
      const audio = new Audio(`/audio/${file}`)
      audio.play()
      return
    }
    if (!('speechSynthesis' in window)) {
      alert('瀏覽器不支援語音合成')
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    if (zhHKVoice) utterance.voice = zhHKVoice
    utterance.lang = zhHKVoice?.lang || 'zh-HK'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  // 收藏當前詞條
  const addToFavorites = () => {
    if (!output) return
    const key = `${output.yue} | ${output.jyut}`
    if (!favorites.includes(key)) {
      const updated = [...favorites, key]
      setFavorites(updated)
      localStorage.setItem('favorites', JSON.stringify(updated))
    }
  }

  // 完成單個任務
  const handleTaskSubmit = (
    index: number,
    data: { zh: string; yue: string; jyut: string; emoji?: string; emotion?: string; note?: string }
  ) => {
    // 保存到本地貢獻，包含表情與情感
    const list = JSON.parse(localStorage.getItem('contrib') || '[]') as any[]
    list.push({ ...data, date: new Date().toISOString() })
    localStorage.setItem('contrib', JSON.stringify(list))
    // 標記任務完成
    localStorage.setItem(`task_done_${todayKey()}_${index}`, '1')
    // 顯示感謝提示
    alert('感謝您為守護粵語付出的貢獻！')
  }

  // 導出貢獻 JSON
  const exportContrib = () => {
    const data = localStorage.getItem('contrib') || '[]'
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contrib_${todayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 子組件：任務行
  const TaskRow: React.FC<{
    index: number
    base: string
    onSubmit: (
      index: number,
      data: { zh: string; yue: string; jyut: string; emoji?: string; emotion?: string; note?: string }
    ) => void
  }> = ({ index, base, onSubmit }) => {
    const [form, setForm] = useState({ zh: base, yue: '', jyut: '', emoji: '', emotion: '', note: '' })
    const done = Boolean(localStorage.getItem(`task_done_${todayKey()}_${index}`))
    if (done) {
      return (
        <div
          style={{
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid #333',
            background: '#0c0c0c',
            color: '#86efac',
            fontSize: '14px'
          }}
        >
          ✅ 已提交：{base}
        </div>
      )
    }
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1.5fr 1.5fr 1fr 1fr auto',
          gap: '8px',
          marginBottom: '6px'
        }}
      >
        <input
          value={form.zh}
          onChange={(e) => setForm({ ...form, zh: e.target.value })}
          placeholder="原文"
          style={inputStyle}
        />
        <input
          value={form.yue}
          onChange={(e) => setForm({ ...form, yue: e.target.value })}
          placeholder="粵語正字"
          style={inputStyle}
        />
        <input
          value={form.jyut}
          onChange={(e) => setForm({ ...form, jyut: e.target.value })}
          placeholder="粵拼 (Jyutping)"
          style={inputStyle}
        />
        <input
          value={form.emoji}
          onChange={(e) => setForm({ ...form, emoji: e.target.value })}
          placeholder="Emoji"
          style={inputStyle}
        />
        <input
          value={form.emotion}
          onChange={(e) => setForm({ ...form, emotion: e.target.value })}
          placeholder="情感描述"
          style={inputStyle}
        />
        <button
          onClick={() => {
            if (!form.yue || !form.jyut) {
              alert('請填寫粵語正字和粵拼')
              return
            }
            onSubmit(index, form)
          }}
          style={buttonStyle}
        >
          提交
        </button>
      </div>
    )
  }

  // 輔助樣式
  const inputStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #333',
    background: '#0a0a0a',
    color: '#ddd'
  }
  const buttonStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #333',
    background: '#10b981',
    color: '#0a0a0a',
    fontWeight: 600
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#e5e5e5',
        padding: '24px',
        fontFamily: 'sans-serif'
      }}
    >
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700 }}>
          講返啲地道嘢 · Cantonese MVP
        </h1>
        <p style={{ opacity: 0.8, marginTop: '4px' }}>
          中/英 → 粵語正字 + 粵拼 + 表情符號，眾包完善粵語詞庫
        </p>
        {/* 翻譯區 */}
        <div
          style={{
            marginTop: '16px',
            background: '#121212',
            border: '1px solid #333',
            borderRadius: '16px',
            padding: '16px'
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>即時翻譯</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="輸入中文/英文，例如：我好開心見到你 / I miss you"
              style={{ flex: 1, ...inputStyle }}
            />
            <button onClick={handleTranslate} style={buttonStyle}>
              轉換
            </button>
          </div>
          {output && (
            <div
              style={{
                marginTop: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: '12px' }}>【粵語】</div>
                  <div style={{ fontSize: '24px', marginTop: '4px' }}>{output.yue}</div>
                  <div style={{ marginTop: '6px' }}>【粵拼】{output.jyut}</div>
                  {output.emoji && (
                    <div style={{ marginTop: '6px', fontSize: '28px' }}>{output.emoji}</div>
                  )}
                  {output.emotion && (
                    <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.6 }}>【情感】{output.emotion}</div>
                  )}
                  {output.note && (
                    <div style={{ opacity: 0.6, fontSize: '12px', marginTop: '4px' }}>
                      {output.note}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => output && speak(output.yue)} style={buttonStyle}>
                    🔊 播放
                  </button>
                  <button onClick={addToFavorites} style={{ ...buttonStyle, background: 'transparent', color: '#e5e5e5' }}>
                    ⭐ 收藏
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* 任務區 */}
        <div
          style={{
            marginTop: '16px',
            background: '#121212',
            border: '1px solid #333',
            borderRadius: '16px',
            padding: '16px'
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
              今日任務 · 請填寫以下 {tasks.length} 條短語以守護粵語
            </h3>
            <button
              onClick={exportContrib}
              style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#e5e5e5' }}
            >
              ⬇️ 導出貢獻 JSON
            </button>
          </div>
          <div style={{ marginTop: '8px' }}>
            {tasks.map((t, i) => (
              <TaskRow key={i} index={i} base={t} onSubmit={handleTaskSubmit} />
            ))}
          </div>
          {/* 任務說明 */}
          <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.7 }}>
            提示：請填寫粵語正字、粵拼、情感和表情符號，共同完善粵語詞庫。
          </div>
        </div>
        {/* 收藏區 */}
        <div
          style={{
            marginTop: '16px',
            background: '#121212',
            border: '1px solid #333',
            borderRadius: '16px',
            padding: '16px'
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>我的收藏</h3>
          {favorites.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: '14px', marginTop: '6px' }}>
              尚未收藏。
            </div>
          ) : (
            <ul
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '8px',
                marginTop: '8px'
              }}
            >
              {favorites.map((f, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: '13px',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '10px',
                    padding: '10px'
                  }}
                >
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default App