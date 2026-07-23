import { useState, useEffect, useCallback } from 'react'
import Panel from '../components/Panel'
import PageHeader, { fieldClass } from '../components/PageHeader'
import Icon from '../components/Icon'
import { getRules, createRule, updateRule, deleteRule } from '../services/api'
import { useSocket } from '../services/socket'

const TYPES = [
  { v: 'ip', label: 'IP Address', ph: 'e.g. 10.0.0.5' },
  { v: 'app', label: 'Application', ph: 'e.g. YouTube' },
  { v: 'domain', label: 'Domain', ph: 'e.g. youtube.com' },
]

const TYPE_BADGE = {
  ip: 'bg-accent/12 text-accent border-accent/25',
  app: 'bg-low/12 text-low border-low/25',
  domain: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25',
}

export default function Rules() {
  const [rules, setRules] = useState([])
  const [type, setType] = useState('ip')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    try {
      const res = await getRules()
      setRules(res.data || [])
    } catch (err) {
      console.error('Rules fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  // Keep in sync if another client (or the engine's effect) changes rules.
  useSocket('rules_update', () => fetchRules())

  const activeType = TYPES.find((t) => t.v === type) || TYPES[0]

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    if (!value.trim()) {
      setError('Value is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await createRule({ type, value: value.trim(), note: note.trim() })
      setRules((prev) => [res.rule, ...prev])
      setValue('')
      setNote('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add rule')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (rule) => {
    try {
      const res = await updateRule(rule._id, { enabled: !rule.enabled })
      setRules((prev) => prev.map((r) => (r._id === rule._id ? res.rule : r)))
    } catch (err) {
      console.error('Toggle error', err)
    }
  }

  const handleDelete = async (rule) => {
    try {
      await deleteRule(rule._id)
      setRules((prev) => prev.filter((r) => r._id !== rule._id))
    } catch (err) {
      console.error('Delete error', err)
    }
  }

  const enabledCount = rules.filter((r) => r.enabled).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Block Rules"
        subtitle={`${enabledCount} active · the engine hot-reloads this list every 5s (no restart)`}
      />

      {/* Add rule */}
      <Panel title="Add Rule">
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Type</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setError('')
              }}
              className={fieldClass}
            >
              {TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 flex-col gap-1" style={{ minWidth: 200 }}>
            <span className="text-xs font-medium text-muted">Value</span>
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError('')
              }}
              placeholder={activeType.ph}
              className={fieldClass}
            />
          </label>

          <label className="flex flex-1 flex-col gap-1" style={{ minWidth: 160 }}>
            <span className="text-xs font-medium text-muted">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this rule?"
              className={fieldClass}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-2 disabled:opacity-50"
          >
            <Icon name="plus" className="h-4 w-4" />
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-crit">{error}</p>}
      </Panel>

      {/* Rules table */}
      <Panel title="Active Blocklist" bodyClass="">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge-soft text-[11px] uppercase tracking-wider text-faint">
                <th className="py-2.5 pl-4 pr-3 text-left font-medium">Type</th>
                <th className="py-2.5 pr-3 text-left font-medium">Value</th>
                <th className="py-2.5 pr-3 text-left font-medium">Note</th>
                <th className="py-2.5 pr-3 text-left font-medium">Added</th>
                <th className="py-2.5 pr-3 text-center font-medium">Status</th>
                <th className="py-2.5 pr-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-faint">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-faint">
                    No block rules yet. Add one above — it takes effect in the engine within 5s.
                  </td>
                </tr>
              )}
              {rules.map((r) => (
                <tr
                  key={r._id}
                  className="border-b border-edge-soft/60 transition-colors last:border-0 hover:bg-elevated/60"
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${
                        TYPE_BADGE[r.type] || TYPE_BADGE.ip
                      }`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-ink">{r.value}</td>
                  <td className="max-w-xs truncate py-2.5 pr-3 text-muted">{r.note || '—'}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-muted tnum">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    <button
                      onClick={() => handleToggle(r)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        r.enabled
                          ? 'bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-edge text-faint hover:bg-elevated'
                      }`}
                      title={r.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.enabled ? 'bg-emerald-400' : 'bg-faint'
                        }`}
                      />
                      {r.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <button
                      onClick={() => handleDelete(r)}
                      className="inline-grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-crit/12 hover:text-crit"
                      title="Delete rule"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
