/**
 * Impeccable design detector for OpenCode (v2 plugin API).
 *
 * Why this file exists: `impeccable install` ships a native post-edit hook only for
 * Claude Code, GitHub Copilot, Codex, Cursor and Grok Build — OpenCode is a supported
 * *skill* target but has no hook surface (docs/conventions.md §15). Without this plugin the
 * mechanical design scan depends on the agent remembering step 3 of the UI ritual.
 *
 * What it does: after a successful edit/write/patch of a UI file under `app/`, it runs
 * `impeccable detect --json` on that file and queues the primary findings. On the next model
 * call of the same session it appends them to the system context, so the agent sees them while
 * the change is still in context. Advisory findings stay out of the delivery — the detector does
 * not fail on them either. It never blocks a write: verdict on the design still belongs to
 * `impeccable-finish-reviewer`, and the hard gate is `pnpm ui:detect`.
 *
 * Debug: IMPECCABLE_PLUGIN_DEBUG=1 appends one NDJSON line per interesting event to
 * .impeccable/opencode-plugin.log (gitignored as *.log).
 */
import { execFile } from 'node:child_process'
import { appendFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const runDetached = promisify(execFile)

/** Launcher shipped with the skill; a missing launcher is a silent no-op, like the official hooks. */
const LAUNCHER = path.join('.agents', 'skills', 'impeccable', 'scripts', 'impeccable')
const EDIT_TOOLS = new Set(['edit', 'write', 'multiedit', 'apply_patch', 'patch'])
const UI_FILE = /\.(vue|css|scss|sass|html)$/
const MAX_FINDINGS = 12

interface Finding {
  advisory?: boolean
  antipattern?: string
  description?: string
  file?: string
  line?: number
  name?: string
  severity?: string
  snippet?: string
}

interface ToolEvent {
  tool?: string
  sessionID?: string
  status?: string
  input?: unknown
  error?: unknown
}

interface ContextEvent {
  sessionID?: string
  system?: Array<{ text?: string, type?: string }>
}

/** Findings waiting for the next model call, keyed by session (`unknown` = any session). */
const pending = new Map<string, string[]>()

function debug(line: string): void {
  if (process.env.IMPECCABLE_PLUGIN_DEBUG !== '1') return
  try {
    appendFileSync('.impeccable/opencode-plugin.log', `${new Date().toISOString()} ${line}\n`)
  } catch {
    // A debug trace must never break a session.
  }
}

/** Absolute-ish paths a tool call touched, whatever the tool's input shape was. */
function touchedPaths(input: unknown): string[] {
  if (!input || typeof input !== 'object') return []
  const record = input as Record<string, unknown>
  const paths: string[] = []
  for (const key of ['filePath', 'path', 'file', 'target']) {
    const value = record[key]
    if (typeof value === 'string') paths.push(value)
  }

  const files = record.files
  if (Array.isArray(files)) {
    for (const entry of files) {
      if (entry && typeof entry === 'object') {
        const nested = entry as Record<string, unknown>
        if (typeof nested.path === 'string') paths.push(nested.path)
        if (typeof nested.filePath === 'string') paths.push(nested.filePath)
      }
    }
  }

  // apply_patch carries paths only inside the patch body.
  if (typeof record.patch === 'string') {
    for (const match of record.patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gmu)) {
      const captured = match[1]
      if (captured) paths.push(captured.trim())
    }
  }

  return paths
}

function isUiFile(file: string): boolean {
  const normalised = file.replaceAll('\\', '/')
  return normalised.includes('app/') && UI_FILE.test(normalised) && !normalised.includes('components/ui/')
}

async function detect(root: string, file: string): Promise<Finding[]> {
  const absolute = path.isAbsolute(file) ? file : path.join(root, file)
  if (!existsSync(absolute)) return []

  const args = ['detect', '--json', path.relative(root, absolute) || absolute]
  const parse = (stdout: string | undefined): Finding[] => {
    try {
      const parsed: unknown = JSON.parse(stdout || '[]')
      return Array.isArray(parsed) ? parsed.filter((entry): entry is Finding => Boolean(entry && typeof entry === 'object')) : []
    } catch {
      debug(`unreadable detector output for ${file}`)
      return []
    }
  }

  try {
    return parse((await runDetached(path.join(root, LAUNCHER), args, { cwd: root, timeout: 45_000 })).stdout)
  } catch (error) {
    // Exit 2 is the detector saying "primary findings" — the payload rides on the rejected error.
    const failure = error as { code?: number, stdout?: string }
    if (failure.code === 2) return parse(failure.stdout)
    debug(`detect unavailable for ${file}: code ${failure.code ?? '?'}`)
    return []
  }
}

function format(file: string, findings: Finding[]): string[] {
  return findings.slice(0, MAX_FINDINGS).map((finding) => {
    const where = finding.line ? `${file}:${finding.line}` : file
    const rule = finding.antipattern ?? finding.name ?? 'design-finding'
    const detail = finding.description ?? finding.snippet ?? 'no description'
    return `- impeccable detect · ${rule} · ${where} — ${detail}`
  })
}

function drain(sessionID: string | undefined): string[] {
  const lines = pending.get(sessionID ?? 'unknown') ?? []
  const shared = pending.get('unknown') ?? []
  pending.delete(sessionID ?? 'unknown')
  pending.delete('unknown')
  return [...new Set([...lines, ...shared])]
}

export default {
  id: 'project.impeccable-detector',

  async setup(ctx: {
    app?: {
      log?: (input: { body: { extra?: Record<string, unknown>, level: string, message: string, service: string } }) => Promise<unknown>
      version?: string
    }
    location?: { directory?: string, project?: { canonical?: string } }
    session?: { hook?: (name: string, cb: (event: ContextEvent) => Promise<void> | void) => Promise<unknown> }
    tool?: { hook?: (name: string, cb: (event: ToolEvent) => Promise<void> | void) => Promise<unknown> }
  }) {
    const root = ctx.location?.project?.canonical ?? ctx.location?.directory ?? process.cwd()

    // OpenCode's own log is the live trace; the file trace is for IMPECCABLE_PLUGIN_DEBUG=1 runs.
    await ctx.app?.log?.({
      body: {
        service: 'impeccable-detector',
        level: existsSync(path.join(root, LAUNCHER)) ? 'info' : 'warn',
        message: existsSync(path.join(root, LAUNCHER))
          ? `design detector armed for UI edits in ${root}`
          : `design detector inactive: ${LAUNCHER} not found`,
        extra: { root, version: ctx.app?.version },
      },
    })

    if (!existsSync(path.join(root, LAUNCHER))) {
      debug(`launcher missing at ${LAUNCHER} — plugin inactive`)
      return
    }

    debug(`loaded in OpenCode ${ctx.app?.version ?? '?'}, root ${root}`)

    await ctx.tool?.hook?.('execute.after', async (event) => {
      const tool = event.tool ?? ''
      if (!EDIT_TOOLS.has(tool)) return
      const files = touchedPaths(event.input).filter(isUiFile)
      const [first] = files
      debug(`execute.after tool=${tool} status=${event.status ?? '?'} ui=[${files.join(',')}]`)
      if (!first) return

      const findings = (await detect(root, first)).filter(finding => !finding.advisory && finding.severity !== 'advisory')
      if (!findings[0]) return

      const key = event.sessionID ?? 'unknown'
      const lines = findings.map(finding => format(path.relative(root, finding.file ?? first), [finding]))
      pending.set(key, [...(pending.get(key) ?? []), ...lines])
      debug(`queued ${lines.length} finding(s) for ${key}`)
    })

    await ctx.session?.hook?.('context', async (event) => {
      const lines = drain(event.sessionID)
      if (!lines[0]) return
      const report = [
        'Impeccable design detector ran on the last UI edits. Fix what is real, or record an',
        'intentional exception with `npx impeccable ignores add-value <rule> <value> --reason "…"`',
        '— never leave a finding unaddressed and unrecorded:',
        ...lines,
      ].join('\n')
      event.system?.push({ type: 'text', text: report })
      debug(`delivered ${lines.length} finding(s) to the next model call`)
    })
  },
}
