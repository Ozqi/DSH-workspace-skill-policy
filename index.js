import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { homedir } from 'node:os'

export const name = 'workspace-skill-policy'
export const inject = ['commands', 'connection', 'skills', 'workingDirectory', 'workspaceRegistry', 'sessions', 'agents', 'agentPresets', 'subprocess']

const PROVIDER = 'workspace-skill-policy'
const DISABLED = Object.freeze({ modelInvocable: false, userInvocable: false })
const ROUTE = '/api/workspace-skill-policy'
const ROOT_SPECS = Object.freeze([
  { root: ['.agents', 'skills'], mode: 'children' },
  { root: ['.dsh', 'skills'], mode: 'children' },
  { root: ['.agent', 'skills'], mode: 'children' },
  { root: ['.agent'], mode: 'direct' },
  { root: ['.agent'], mode: 'nestedSkills' },
])
const isSkillName = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
const ARCHIVE_REPO = 'https://github.com/Ozqi/SKILLS'
const storePath = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'workspace-skill-policy.json')

async function readPolicies() {
  try {
    const value = JSON.parse(await readFile(storePath(), 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyPolicies()
    return {
      sessions: objectOfArrays(value.sessions),
      workspaces: objectOfArrays(value.workspaces ?? value),
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyPolicies()
    throw error
  }
}

function emptyPolicies() {
  return { sessions: {}, workspaces: {} }
}

function objectOfArrays(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .filter(([, names]) => Array.isArray(names))
    .map(([key, names]) => [key, [...new Set(names.filter(isSkillName))].sort()]))
}

async function writePolicies(value) {
  const path = storePath()
  const temp = `${path}.tmp`
  const clean = {
    sessions: stripEmpty(value.sessions),
    workspaces: stripEmpty(value.workspaces),
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(temp, `${JSON.stringify(clean, null, 2)}\n`, { mode: 0o600 })
  await rename(temp, path)
}

function stripEmpty(value) {
  return Object.fromEntries(Object.entries(value).filter(([, names]) => names.length > 0))
}

async function workspaceForCwd(ctx, cwd) {
  if (!cwd) return undefined
  try { return await ctx.workspaceRegistry.resolveByPath(cwd) } catch { return undefined }
}

function blockedNames(policies, sessionId, workspaceId) {
  return [...new Set([
    ...arrayAt(policies.sessions, sessionId),
    ...arrayAt(policies.workspaces, workspaceId),
  ])].sort()
}

function arrayAt(map, key) {
  return typeof key === 'string' && Array.isArray(map[key]) ? map[key].filter(isSkillName) : []
}

function candidate(skillName) {
  return {
    name: skillName,
    description: 'Disabled for this session or workspace by the skill policy plugin.',
    invocation: DISABLED,
    source: 'workspace-policy',
    provider: PROVIDER,
    rank: 0,
    locator: skillName,
  }
}

export function apply(ctx) {
  let invalidate
  ctx.effect(() => ctx.skills.registerProvider((control) => {
    invalidate = control.invalidate
    return {
      name: PROVIDER,
      async list(options) {
        const sessionId = typeof options.scope?.id === 'string' ? options.scope.id : undefined
        const workspace = await workspaceForCwd(ctx, options.cwd)
        return blockedNames(await readPolicies(), sessionId, workspace?.id).map(candidate)
      },
      async get(entry) {
        return { ...candidate(entry.name), content: '' }
      },
    }
  }), 'workspace-skill-policy: provider')

  ctx.effect(() => ctx.commands.register({
    name: 'skills',
    description: 'Manage disabled skills for this session',
    input: { hint: 'list | block <name> | unblock <name> | clear' },
    recordInput: false,
    async handler(invocation) {
      const sessionId = invocation.agent.id
      const cwd = await ctx.workingDirectory.ensure(invocation.agent, invocation.signal)
      const workspace = await workspaceForCwd(ctx, cwd)
      const words = invocation.rawInput.trim().replace(/^\/skills\s*/u, '').split(/\s+/u).filter(Boolean)
      const operation = words[0] || 'list'
      const policies = await readPolicies()
      const current = new Set(blockedNames(policies, sessionId, workspace?.id))
      if (operation === 'list') return { kind: 'success', text: render(current) }
      if (operation === 'clear' && words.length === 1) current.clear()
      else if ((operation === 'block' || operation === 'unblock') && words.length === 2 && isSkillName(words[1])) {
        if (operation === 'block') current.add(words[1])
        else current.delete(words[1])
      } else return { kind: 'error', text: 'Usage: /skills list | /skills block <name> | /skills unblock <name> | /skills clear' }
      policies.sessions[sessionId] = [...current].sort()
      await writePolicies(policies)
      invalidate?.()
      return { kind: 'success', text: render(current) }
    },
  }), 'workspace-skill-policy: command')

  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE,
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: request => route(ctx, request, () => { invalidate?.() }),
  }), 'workspace-skill-policy: route')
}

async function route(ctx, request, invalidate) {
  try {
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams
      const sessionId = params.get('sessionId')
      const skillName = params.get('skill')
      return Response.json(skillName === null
        ? await snapshot(ctx, sessionId, request.signal)
        : await skillContent(ctx, sessionId, skillName, request.signal), noStore())
    }
    const body = await request.json()
    if (!body || typeof body !== 'object') return text('Invalid request.', 400)
    const sessionId = body.sessionId
    if (typeof sessionId !== 'string') return text('Invalid request.', 400)
    const name = body.name
    if (!isSkillName(name) || typeof body.disabled !== 'boolean') return text('Invalid request.', 400)
    const policies = await readPolicies()
    const current = new Set(arrayAt(policies.sessions, sessionId))
    if (body.disabled) current.add(name)
    else current.delete(name)
    policies.sessions[sessionId] = [...current].sort()
    await writePolicies(policies)
    invalidate()
    return Response.json(await snapshot(ctx, sessionId, request.signal), noStore())
  } catch (error) {
    request.signal.throwIfAborted()
    return text(error instanceof Error ? error.message : 'Skill policy failed.', 500)
  }
}

function noStore() {
  return { headers: { 'cache-control': 'no-store' } }
}

function text(message, status) {
  return new Response(message, { status, headers: { 'cache-control': 'no-store' } })
}

async function sessionContext(ctx, sessionId, signal) {
  if (!sessionId) throw new Error('Missing session id.')
  const session = ctx.sessions.get(sessionId)
  if (!session) throw new Error(`Session not found: ${sessionId}`)
  const agent = ctx.agents.get(sessionId)
  const cwd = agent ? await ctx.workingDirectory.ensure(agent, signal) : ctx.workingDirectory.get(session)
  return { session, agent, cwd, workspace: await workspaceForCwd(ctx, cwd) }
}

async function snapshot(ctx, sessionId, signal) {
  const { agent, cwd, workspace } = await sessionContext(ctx, sessionId, signal)
  const policies = await readPolicies()
  const disabled = new Set(blockedNames(policies, sessionId, workspace?.id))
  const catalog = await visibleCatalog(ctx, cwd, agent, signal)
  const detected = await detectSkills(cwd)
  const byName = new Map()
  for (const skill of [...catalog, ...detected, ...[...disabled].map(name => ({ name, description: '', sources: [] }))]) {
    const existing = byName.get(skill.name)
    byName.set(skill.name, mergeSkill(existing, skill, disabled.has(skill.name)))
  }
  for (const skill of byName.values()) {
    const github = await githubInfo(ctx, cwd, skill.sources, signal)
    skill.github = github ?? archiveGithubInfo(skill.name)
  }
  return {
    sessionId,
    cwd,
    workspace: workspace ? { id: workspace.id, title: workspace.title, path: workspace.path } : null,
    disabled: [...disabled].sort(),
    skills: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    roots: summarizeRoots(detected),
  }
}

async function skillContent(ctx, sessionId, name, signal) {
  if (!isSkillName(name)) throw new Error('Invalid skill name.')
  const { agent, cwd } = await sessionContext(ctx, sessionId, signal)
  const catalog = await visibleCatalog(ctx, cwd, agent, signal)
  const detected = await detectSkills(cwd)
  const skill = [...catalog, ...detected].find(entry => entry.name === name)
  if (!skill) throw new Error(`Skill not found: ${name}`)
  const paths = uniqueSources(skill.sources ?? []).map(source => source.path)
  for (const path of paths) {
    const absolute = path.startsWith('/') ? path : join(cwd, path)
    try {
      const content = await readFile(absolute, 'utf8')
      signal.throwIfAborted()
      return { name, path, content }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  const definition = await loadCatalogSkill(ctx, agent, cwd, name, signal)
  if (definition?.content !== undefined) return { name, path: definition.path ?? null, content: definition.content }
  throw new Error(`Skill content unavailable: ${name}`)
}

async function loadCatalogSkill(ctx, agent, cwd, name, signal) {
  const scoped = agent ? ctx.agentPresets?.serviceFor?.(agent, 'skills') : undefined
  const service = scoped?.get ? scoped : ctx.skills
  return service.get(name, { cwd, scope: agent, signal })
}

async function visibleCatalog(ctx, cwd, agent, signal) {
  const list = agent && ctx.agentPresets?.serviceFor?.(agent, 'skills')?.list ? ctx.agentPresets.serviceFor(agent, 'skills').list.bind(ctx.agentPresets.serviceFor(agent, 'skills')) : ctx.skills.list.bind(ctx.skills)
  try {
    return (await list({ cwd, scope: agent, signal })).map(skill => ({
      name: skill.name,
      description: skill.description || '',
      modelInvocable: skill.invocation?.modelInvocable !== false,
      userInvocable: skill.invocation?.userInvocable !== false,
      sources: skill.path ? [{ kind: 'catalog', path: skill.path.startsWith(cwd) ? relative(cwd, skill.path) : skill.path }] : [],
    }))
  } catch {
    return []
  }
}

function archiveGithubInfo(name) {
  return {
    url: ARCHIVE_REPO,
    fileUrl: `${ARCHIVE_REPO}/blob/main/${encodeURIComponent(name)}/SKILL.md`,
    archived: true,
  }
}

async function githubInfo(ctx, cwd, sources, signal) {
  for (const source of sources ?? []) {
    const file = source.path?.startsWith('/') ? source.path : join(cwd, source.path || '')
    const repoRoot = await gitTopLevel(ctx, file, signal)
    if (!repoRoot) continue
    const remote = await gitRemote(ctx, repoRoot, signal)
    const normalized = normalizeGithubRemote(remote)
    if (!normalized) continue
    const branch = await gitOutput(ctx, repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], signal).catch(() => '')
    const rel = relative(repoRoot, file).split(/[\\/]/u).map(encodeURIComponent).join('/')
    return {
      url: normalized,
      repoRoot,
      fileUrl: `${normalized}/blob/${encodeURIComponent(branch || 'main')}/${rel}`,
    }
  }
}

async function gitTopLevel(ctx, path, signal) {
  const cwd = dirname(path)
  return gitOutput(ctx, cwd, ['rev-parse', '--show-toplevel'], signal).catch(() => undefined)
}

async function gitRemote(ctx, cwd, signal) {
  return gitOutput(ctx, cwd, ['config', '--get', 'remote.origin.url'], signal).catch(() => undefined)
}

async function gitOutput(ctx, cwd, args, signal) {
  const git = await ctx.subprocess.resolveExecutable('git', undefined, signal)
  const handle = ctx.subprocess.spawn({
    argv: [git, ...args],
    cwd,
    stdio: { stdin: 'ignore', stdout: { maxBytes: 16 * 1024 }, stderr: { maxBytes: 16 * 1024 } },
    graceMs: 1_000,
    signal,
    env: { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
  })
  const outcome = await handle.done
  signal?.throwIfAborted?.()
  if (outcome.exitCode !== 0) throw new Error(handle.collected.stderr?.readFrom(0).text.trim() || 'git failed')
  return (handle.collected.stdout?.readFrom(0).text ?? '').trim()
}

function normalizeGithubRemote(remote) {
  if (!remote) return undefined
  const trimmed = remote.trim().replace(/\.git$/u, '')
  const https = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/u)
  if (https) return `https://github.com/${https[1]}/${https[2]}`
  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+)$/u)
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`
}

function mergeSkill(existing, next, disabled) {
  const sources = [...existing?.sources ?? [], ...next.sources ?? []]
  return {
    name: next.name,
    description: existing?.description || next.description || '',
    modelInvocable: existing?.modelInvocable ?? next.modelInvocable ?? true,
    userInvocable: existing?.userInvocable ?? next.userInvocable ?? true,
    disabled,
    sources: uniqueSources(sources),
  }
}

function uniqueSources(sources) {
  const seen = new Set()
  return sources.filter(source => {
    const key = `${source.kind}:${source.path}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function summarizeRoots(skills) {
  const roots = new Map()
  for (const skill of skills) for (const source of skill.sources) {
    const entry = roots.get(source.root) ?? { path: source.root, count: 0 }
    entry.count += 1
    roots.set(source.root, entry)
  }
  return [...roots.values()].sort((a, b) => a.path.localeCompare(b.path))
}

async function detectSkills(cwd) {
  const found = []
  for (const spec of ROOT_SPECS) {
    const root = join(cwd, ...spec.root)
    if (spec.mode === 'children') found.push(...await childSkillDirs(root, cwd))
    else if (spec.mode === 'direct') found.push(...await directAgentDirs(root, cwd))
    else found.push(...await nestedAgentSkillDirs(root, cwd))
  }
  const byName = new Map()
  for (const skill of found) byName.set(skill.name, mergeSkill(byName.get(skill.name), skill, false))
  return [...byName.values()]
}

async function childSkillDirs(root, cwd) {
  const entries = await safeReaddir(root)
  const skills = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSkillName(entry.name)) continue
    const dir = join(root, entry.name)
    if (await hasSkillFile(dir)) skills.push(detectedSkill(entry.name, dir, root, cwd))
  }
  return skills
}

async function directAgentDirs(root, cwd) {
  const entries = await safeReaddir(root)
  const skills = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSkillName(entry.name) || entry.name === 'skills') continue
    const dir = join(root, entry.name)
    if (await hasSkillFile(dir)) skills.push(detectedSkill(entry.name, dir, root, cwd))
  }
  return skills
}

async function nestedAgentSkillDirs(root, cwd) {
  const groups = await safeReaddir(root)
  const skills = []
  for (const group of groups) {
    if (!group.isDirectory() || group.name === 'skills') continue
    skills.push(...await childSkillDirs(join(root, group.name, 'skills'), cwd))
  }
  return skills
}

async function safeReaddir(path) {
  try { return await readdir(path, { withFileTypes: true }) } catch { return [] }
}

async function hasSkillFile(dir) {
  try { return (await stat(join(dir, 'SKILL.md'))).isFile() } catch { return false }
}

function detectedSkill(name, dir, root, cwd) {
  return {
    name,
    description: '',
    sources: [{ kind: 'detected', path: relative(cwd, join(dir, 'SKILL.md')), root: relative(cwd, root) }],
  }
}

function render(blocked) {
  const names = [...blocked].sort()
  return names.length === 0
    ? 'No skills are disabled for this session.'
    : `Disabled skills for this session: ${names.map(name => `\`${name}\``).join(', ')}`
}
