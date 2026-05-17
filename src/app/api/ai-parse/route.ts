import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

const ParseCardSchema = z.object({
  text: z.string().min(1).max(1000),
})

interface ParsedCard {
  title: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  tags: string[]
  deadline?: string
  description?: string
}

function regexParse(text: string): ParsedCard {
  const lower = text.toLowerCase()

  let priority: ParsedCard['priority'] = 'MEDIUM'
  if (/срочно|urgent|asap|критично|горит/i.test(text)) priority = 'URGENT'
  else if (/важно|important|высокий|high/i.test(text)) priority = 'HIGH'
  else if (/низкий|low|когда-нибудь/i.test(text)) priority = 'LOW'

  const tags: string[] = []
  if (/баг|bug|ошибка|error|fix/i.test(text)) tags.push('bug')
  if (/ревью|review|pr|pull request/i.test(text)) tags.push('review')
  if (/дизайн|design|ui|ux/i.test(text)) tags.push('design')
  if (/backend|бэкенд|api|сервер/i.test(text)) tags.push('backend')
  if (/frontend|фронтенд|ui|интерфейс/i.test(text)) tags.push('frontend')
  if (/документация|docs|readme/i.test(text)) tags.push('docs')
  if (priority === 'URGENT') tags.push('urgent')

  let deadline: string | undefined
  const datePatterns = [
    { regex: /завтра/i, days: 1 },
    { regex: /послезавтра/i, days: 2 },
    { regex: /сегодня/i, days: 0 },
    { regex: /через\s+(\d+)\s+дн/i, extract: 'days' },
    { regex: /friday|пятницу?/i, days: getNextWeekday(5) },
    { regex: /monday|понедельник/i, days: getNextWeekday(1) },
  ]

  for (const p of datePatterns) {
    if (p.regex.test(text)) {
      const d = new Date()
      if ('days' in p && typeof p.days === 'number') {
        d.setDate(d.getDate() + p.days)
        d.setHours(23, 59, 0, 0)
        deadline = d.toISOString()
        break
      }
    }
  }

  let title = text
    .replace(/срочно[,!]?\s*/i, '')
    .replace(/до (пятницы|понедельника|вторника|среды|четверга|субботы|воскресенья)/i, '')
    .replace(/завтра/i, '')
    .replace(/послезавтра/i, '')
    .trim()
  if (title.length > 100) title = title.slice(0, 100)
  if (!title) title = text.slice(0, 100)

  return { title, priority, tags, deadline }
}

function getNextWeekday(targetDay: number): number {
  const today = new Date().getDay()
  const diff = (targetDay - today + 7) % 7
  return diff === 0 ? 7 : diff
}

async function claudeParse(text: string): Promise<ParsedCard> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return regexParse(text)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      signal: AbortSignal.timeout(5000),
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Parse this task description into a structured Kanban card. Return ONLY valid JSON.

Task: "${text}"

Return JSON with these exact fields:
{
  "title": "concise task title (max 80 chars)",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "tags": ["array", "of", "relevant", "tags"],
  "deadline": "ISO 8601 datetime or null",
  "description": "optional longer description or null"
}

Rules:
- priority URGENT if: "срочно", "срочный", "urgent", "asap", "горит", "критично"
- priority HIGH if: "важно", "important", "высокий приоритет"
- deadline: parse relative dates (завтра=tomorrow, до пятницы=next friday, etc.)
- tags: bug, review, design, backend, frontend, docs, urgent, feature
- title: remove filler words like "срочно", keep the actual task`,
          },
        ],
      }),
    })

    if (!res.ok) return regexParse(text)

    const json = await res.json()
    const content = json.content?.[0]?.text || ''
    const parsed = JSON.parse(content)
    return {
      title: parsed.title || text.slice(0, 80),
      priority: parsed.priority || 'MEDIUM',
      tags: parsed.tags || [],
      deadline: parsed.deadline || undefined,
      description: parsed.description || undefined,
    }
  } catch {
    return regexParse(text)
  }
}

// POST /api/ai-parse
export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = ParseCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
  }

  const result = await claudeParse(parsed.data.text)
  return NextResponse.json({ data: result, ok: true })
}
