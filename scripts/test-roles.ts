/**
 * Изолированный прогон каждой LLM-роли (отладка схем/промптов без пайплайна).
 * Использование: pnpm tsx scripts/test-roles.ts [roleName ...]
 * Без аргументов — все LLM-роли по очереди.
 */
import 'temporal-polyfill/full/global'
import 'dotenv/config'

import { getRoleConfig } from '../config/roles'
import { callLlm } from '../server/utils/llm'

const LLM_ROLES = ['orchestrator', 'idea_analyst', 'market_analyst', 'strategist', 'critic'] as const

const IDEA = `Автоматический разбор входящих обращений: обращение клиента (текст или голос) обрабатывает ИИ-классификатор, определяющий категорию, приоритет и ответственный отдел. Оператор только проверяет черновик. Сейчас оператор тратит 6 минут на обращение вручную, 12% обращений уходят не в тот отдел.`

const MARKET_FIXTURE = JSON.stringify({
  competitors: [{ description: 'ручная сортировка операторами', name: 'Статус-кво', strengths: ['бесплатно'], weaknesses: ['медленно, 12% ошибок'] }],
  confidence: 'medium',
  insights: ['рынок автоматизации поддержки растёт'],
  marketSize: 'ниша SaaS для поддержки среднего бизнеса',
  personas: [{ goals: ['быстро отвечать'], name: 'Оператор Мария', objections: ['страх замены ручного труда'], painPoints: ['рутинная сортировка'], role: 'оператор поддержки' }],
  segments: [{ characteristics: ['50+ обращений в день'], name: 'средний бизнес', size: 'средний', willingnessToPay: 'medium' }],
  trends: ['LLM-автоматизация поддержки', 'рост ожиданий скорости ответа'],
})

const STRATEGY_FIXTURE = JSON.stringify({
  experiments: [{ hypothesis: 'ИИ-классификация точнее ручной', method: 'A/B на 100 обращениях', metric: 'доля корректных', resources: '1 разработчик, 2 недели', successThreshold: '≥92%', duration: '2 недели' }],
  experimentPriority: 1,
  recommendations: ['начать с пилота', 'обучить операторов проверке'],
  risks: ['низкое качество классификации на редких категориях'],
  scenarios: [{ description: 'внедрение на весь поток', effect: '-50% времени обработки', keyFactors: ['качество модели'], name: 'базовый', probability: 0.6, type: 'base' }],
  recommendedScenario: 'базовый',
})

const CRITIC_FIXTURE = JSON.stringify({
  efficiency: { scenarios: { base: { timeSaved: 2.5 } } },
  idea: { title: 'ИИ-разбор обращений' },
  market: MARKET_FIXTURE,
  strategy: STRATEGY_FIXTURE,
})

function userPrompt(role: string, idea: string): string {
  const cfg = getRoleConfig(role)
  if (cfg && 'user' in cfg && typeof cfg.user === 'function') {
    const fn = cfg.user
    if (role === 'strategist') return fn(idea, MARKET_FIXTURE)
    if (role === 'critic') return fn(idea, CRITIC_FIXTURE)
    return fn(idea)
  }
  return idea
}

async function testRole(role: (typeof LLM_ROLES)[number]): Promise<boolean> {
  const cfg = getRoleConfig(role)
  if (!cfg || !('system' in cfg)) {
    console.error(`✗ ${role}: нет LLM-конфига`)
    return false
  }
  const llm = cfg as { system: string, schema: Parameters<typeof callLlm>[0], temperature?: number, maxTokens?: number, timeoutMs?: number }
  const started = Date.now()
  try {
    const result = await callLlm(llm.schema, {
      maxTokens: llm.maxTokens,
      system: llm.system,
      temperature: llm.temperature,
      timeoutMs: llm.timeoutMs,
      user: userPrompt(role, IDEA),
    })
    console.log(`✓ ${role} (${Math.round((Date.now() - started) / 1000)}с): ${JSON.stringify(result.data).slice(0, 150)}…`)
    return true
  }
  catch (err) {
    console.error(`✗ ${role} (${Math.round((Date.now() - started) / 1000)}с): ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

const requested = process.argv.slice(2)
const known = new Set<string>(LLM_ROLES)
const unknown = requested.filter(r => !known.has(r))
if (unknown.length) {
  console.error(`Неизвестные роли: ${unknown.join(', ')}. Доступны: ${LLM_ROLES.join(', ')}`)
  process.exit(1)
}

// Было `requested as unknown as (typeof LLM_ROLES)[number][]` — сужение аргументов CLI
// без проверки. Теперь имена проверены выше, а утверждение не нужно.
const roles: readonly string[] = requested.length ? requested : [...LLM_ROLES]

let passed = 0
for (const role of roles) {
  if (await testRole(role)) passed++
}
console.log(`\n${passed}/${roles.length} ролей прошли`)
process.exit(passed === roles.length ? 0 : 1)
