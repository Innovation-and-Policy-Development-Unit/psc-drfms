import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.join(__dirname, '..', 'src')

const DELETE_ONLY = new Set([
  'api/index.js',
  'api/client.js',
  'api/auth.js',
  'api/records.js',
  'context/ThemeContext.jsx',
  'context/AuthContext.jsx',
  'context/NotificationContext.jsx',
  'components/layout/SettingsPanel.jsx',
  'components/drive/FileBrowser.jsx',
  'pages/compliance/LegalHolds.jsx',
  'pages/compliance/OverdueRecords.jsx',
  'pages/compliance/RetentionSchedule.jsx',
  'pages/compliance/DestructionScheduling.jsx',
  'pages/correspondence/CorrespondenceList.jsx',
  'pages/analytics/AnalyticsDashboard.jsx',
  'pages/admin/UserManagement.jsx',
  'pages/admin/SystemHealth.jsx',
])

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, acc)
    else if (/\.(jsx?)$/.test(ent.name)) acc.push(full)
  }
  return acc
}

function rel(p) {
  return path.relative(srcRoot, p).replace(/\\/g, '/')
}

function toAliasImport(match, dots, rest) {
  const depth = dots.length / 3
  const parts = rest.split('/')
  if (depth === 1 && (parts[0] === 'context' || parts[0] === 'api' || parts[0] === 'types' || parts[0] === 'hooks' || parts[0] === 'utils' || parts[0] === 'data')) {
    return `from '@/${rest}'`
  }
  if (depth === 2 && parts[0] === 'components' && ['ui', 'shared', 'layout', 'drive', 'record'].includes(parts[1])) {
    return `from '@/${rest}'`
  }
  if (depth === 2 && parts[0] === 'pages') {
    return `from '@/${rest}'`
  }
  return match
}

function transformContent(content, isTsx) {
  let c = content
  // @/ alias for common src-root imports
  c = c.replace(/from ['"](\.\.\/)+((?:context|api|types|hooks|utils|data)\/[^'"]+)['"]/g, (_, _d, rest) => `from '@/${rest}'`)
  c = c.replace(/from ['"](\.\.\/){2}((?:components\/(?:ui|shared|layout|drive|record))\/[^'"]+)['"]/g, (_, _d, rest) => `from '@/${rest}'`)
  c = c.replace(/from ['"](\.\.\/){2}(pages\/[^'"]+)['"]/g, (_, _d, rest) => `from '@/${rest}'`)
  c = c.replace(/from ['"]\.\/router['"]/g, `from '@/router'`)
  c = c.replace(/from ['"]\.\/App['"]/g, `from '@/App'`)
  c = c.replace(/from ['"]\.\/i18n['"]/g, `from '@/i18n'`)
  c = c.replace(/from ['"]\.\/context\//g, `from '@/context/`)
  c = c.replace(/from ['"]\.\.\/context\//g, `from '@/context/`)

  if (isTsx && !c.includes('React.FC') && c.includes('export default function')) {
    // noop - keep functions as-is
  }

  return c
}

function addWindowDocsAPI(content) {
  if (content.includes('window.DocsAPI') && !content.includes('declare global')) {
    return `declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (id: string, config: Record<string, unknown>) => { destroyEditor?: () => void }
    }
  }
}

${content}`
  }
  return content
}

const converted = []
const deleted = []

for (const file of walk(srcRoot)) {
  const r = rel(file)
  if (DELETE_ONLY.has(r)) {
    fs.unlinkSync(file)
    deleted.push(r)
    continue
  }

  const isJsx = file.endsWith('.jsx')
  const isJs = file.endsWith('.js')
  const out = file.replace(/\.jsx$/, '.tsx').replace(/\.js$/, '.ts')

  if (fs.existsSync(out)) {
    fs.unlinkSync(file)
    deleted.push(r)
    continue
  }

  let content = fs.readFileSync(file, 'utf8')
  content = transformContent(content, isJsx)
  if (isJsx && r.includes('OnlyOfficeEditor')) {
    content = addWindowDocsAPI(content)
  }

  fs.writeFileSync(out, content, 'utf8')
  fs.unlinkSync(file)
  converted.push(r + ' → ' + rel(out))
}

console.log('CONVERTED:', converted.length)
converted.forEach((c) => console.log('  ' + c))
console.log('DELETED (already TS):', deleted.length)
deleted.forEach((d) => console.log('  ' + d))
