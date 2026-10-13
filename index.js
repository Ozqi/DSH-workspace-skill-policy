import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
export const name = 'workspace-skill-policy'
export const inject = ['commands', 'skills', 'workingDirectory', 'workspaceRegistry']

const PROVIDER = 'workspace-skill-policy'
const DISABLED = Object.freeze({ modelInvocable: false, userInvocable: false })
const isSkillName = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
const storePath = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'workspace-skill-policy.json')

async function readPolicies() {
  try {
    const value = JSON.parse(await readFile(storePath(), 'utf8'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    throw error
  }
}

async function writePolicies(value) {
  const path = storePath()
  const temp = `${path}.tmp`
  await mkdir(dirname(path), { recursive: true })
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(temp, path)
}

async function workspaceForCwd(ctx, cwd) {
  if (!cwd) return undefined
  try { return await ctx.workspaceRegistry.resolveByPath(cwd) } catch { return undefined }
}

async function blockedFor(ctx, workspace) {
  if (!workspace) return []
  const value = (await readPolicies())[workspace.id]
  return Array.isArray(value) ? value.filter(isSkillName).sort() : []
}

function candidate(skillName) {
  return {
    name: skillName,
    description: 'Blocked by this workspace skill policy.',
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
        const workspace = await workspaceForCwd(ctx, options.cwd)
        return (await blockedFor(ctx, workspace)).map(candidate)
      },
      async get(entry) {
        return { ...candidate(entry.name), content: '' }
      },
    }
  }), 'workspace-skill-policy: provider')

  ctx.effect(() => ctx.commands.register({
    name: 'skills',
    description: 'Manage blocked skills for this workspace',
    input: { hint: 'list | block <name> | unblock <name> | clear' },
    recordInput: false,
    async handler(invocation) {
      const cwd = await ctx.workingDirectory.ensure(invocation.agent, invocation.signal)
      const workspace = await workspaceForCwd(ctx, cwd)
      if (!workspace) return { kind: 'error', text: `No workspace is registered for ${cwd}.` }
      const words = invocation.rawInput.trim().replace(/^\/skills\s*/u, '').split(/\s+/u).filter(Boolean)
      const operation = words[0] || 'list'
      const policies = await readPolicies()
      const current = new Set(Array.isArray(policies[workspace.id]) ? policies[workspace.id].filter(isSkillName) : [])
      if (operation === 'list') return { kind: 'success', text: render(current) }
      if (operation === 'clear' && words.length === 1) current.clear()
      else if ((operation === 'block' || operation === 'unblock') && words.length === 2 && isSkillName(words[1])) {
        if (operation === 'block') current.add(words[1])
        else current.delete(words[1])
      } else return { kind: 'error', text: 'Usage: /skills list | /skills block <name> | /skills unblock <name> | /skills clear' }
      policies[workspace.id] = [...current].sort()
      await writePolicies(policies)
      invalidate?.()
      return { kind: 'success', text: render(current) }
    },
  }), 'workspace-skill-policy: command')
}

function render(blocked) {
  const names = [...blocked].sort()
  return names.length === 0
    ? 'No skills are blocked for this workspace.'
    : `Blocked skills for this workspace: ${names.map(name => `\`${name}\``).join(', ')}`
}
