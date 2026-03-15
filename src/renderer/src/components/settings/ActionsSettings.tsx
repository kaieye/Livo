/**
 * Actions settings panel — rule editor with conditions and effects.
 */
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useActionsStore } from "../../store/actions-store"
import type { ActionRule, ActionCondition, ActionEffect, ConditionField, ConditionOperator, ActionEffectType } from "../../../../shared/actions"
import {
  CONDITION_FIELD_LABELS,
  CONDITION_OPERATOR_LABELS,
  ACTION_EFFECT_LABELS,
} from "../../../../shared/actions"
import {
  Plus,
  Trash2,
  Power,
  PowerOff,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Upload,
  Edit3,
  X,
  Check,
  Ban,
  Star,
  CheckCircle2,
  Bell,
  BookType,
  Sparkles,
  Zap,
} from "lucide-react"

const EFFECT_ICONS: Record<ActionEffectType, React.ReactNode> = {
  block: <Ban size={14} />,
  star: <Star size={14} />,
  mark_read: <CheckCircle2 size={14} />,
  notify: <Bell size={14} />,
  readability: <BookType size={14} />,
  summarize: <Sparkles size={14} />,
}

export function ActionsSettings() {
  const { rules, isLoaded, loadRules, addRule, updateRule, removeRule, toggleRule, exportRules, importRules } = useActionsStore()
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [importResult, setImportResult] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) loadRules()
  }, [isLoaded, loadRules])

  const handleAdd = () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    const newRule: ActionRule = {
      id,
      name: t("settings.newRule"),
      enabled: true,
      conditions: [{ field: "entry.title", operator: "contains", value: "" }],
      actions: [{ type: "star" }],
      createdAt: Date.now(),
    }
    addRule(newRule)
    setEditingId(id)
    setExpandedIds((prev) => new Set(prev).add(id))
  }

  const handleExport = () => {
    const json = exportRules()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "livo-rules.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const result = await importRules(text)
      setImportResult(t("settings.importRulesResult", { imported: result.imported, errors: result.errors.length ? t("settings.importRulesErrors", { count: result.errors.length }) : "" }))
      setTimeout(() => setImportResult(null), 3000)
    }
    input.click()
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {t("settings.actionsDesc")}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <Plus size={14} />
          {t("settings.addRule")}
        </button>
        <button
          onClick={handleImport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
        >
          <Upload size={14} />
          {t("settings.importRules")}
        </button>
        <button
          onClick={handleExport}
          disabled={rules.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors disabled:opacity-40"
        >
          <Download size={14} />
          {t("settings.exportRules")}
        </button>
        {importResult && (
          <span className="text-xs text-accent ml-2">{importResult}</span>
        )}
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="text-center py-12 text-text-tertiary">
          <Zap size={36} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t("settings.noRules")}</p>
          <p className="text-xs mt-1">{t("settings.noRulesHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isExpanded={expandedIds.has(rule.id)}
              isEditing={editingId === rule.id}
              onToggleExpand={() => toggleExpand(rule.id)}
              onToggleEnabled={() => toggleRule(rule.id)}
              onEdit={() => setEditingId(editingId === rule.id ? null : rule.id)}
              onUpdate={(updates) => updateRule(rule.id, updates)}
              onDelete={() => { removeRule(rule.id); setEditingId(null) }}
              onDoneEditing={() => setEditingId(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RuleCard({
  rule,
  isExpanded,
  isEditing,
  onToggleExpand,
  onToggleEnabled,
  onEdit,
  onUpdate,
  onDelete,
  onDoneEditing,
}: {
  rule: ActionRule
  isExpanded: boolean
  isEditing: boolean
  onToggleExpand: () => void
  onToggleEnabled: () => void
  onEdit: () => void
  onUpdate: (updates: Partial<ActionRule>) => void
  onDelete: () => void
  onDoneEditing: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={`rounded-xl border transition-all ${rule.enabled ? "bg-white dark:bg-surface-dark-secondary" : "bg-surface-secondary dark:bg-surface-dark opacity-60"}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 cursor-pointer" onClick={onToggleExpand}>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="flex-1 text-sm font-medium truncate">{rule.name}</span>

        {/* Summary badges */}
        <div className="flex items-center gap-1">
          {rule.conditions.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-tertiary dark:bg-surface-dark-tertiary text-text-tertiary">
              {rule.conditions.length} {t("settings.conditions")}
            </span>
          )}
          {rule.actions.map((a, i) => (
            <span key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent">
              {EFFECT_ICONS[a.type]}
            </span>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleEnabled() }}
          className={`p-1 rounded transition-colors ${rule.enabled ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20" : "text-text-tertiary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"}`}
          title={rule.enabled ? t("settings.disableRule") : t("settings.enableRule")}
        >
          {rule.enabled ? <Power size={14} /> : <PowerOff size={14} />}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="p-1 rounded hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors"
          title={t("common.edit")}
        >
          <Edit3 size={14} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title={t("common.delete")}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded / editing area */}
      {isExpanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {isEditing ? (
            <RuleEditor rule={rule} onUpdate={onUpdate} onDone={onDoneEditing} />
          ) : (
            <RulePreview rule={rule} />
          )}
        </div>
      )}
    </div>
  )
}

function RulePreview({ rule }: { rule: ActionRule }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 text-xs">
      <div>
        <span className="font-medium text-text-secondary dark:text-text-dark-secondary">{t("settings.conditionsLabel")}</span>
        {rule.conditions.map((c, i) => (
          <div key={i} className="ml-4 mt-1 text-text-secondary dark:text-text-dark-secondary">
            {t(`actionLabels.field_${c.field.replace(".", "_")}`, { defaultValue: CONDITION_FIELD_LABELS[c.field] })} {t(`actionLabels.op_${c.operator}`, { defaultValue: CONDITION_OPERATOR_LABELS[c.operator] })}{" "}
            <span className="font-mono bg-surface-secondary dark:bg-surface-dark-tertiary px-1 rounded">{c.value || t("settings.emptyValue")}</span>
          </div>
        ))}
      </div>
      <div>
        <span className="font-medium text-text-secondary dark:text-text-dark-secondary">{t("settings.actionsLabel")}</span>
        <div className="flex flex-wrap gap-1 mt-1 ml-4">
          {rule.actions.map((a, i) => (
            <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs">
              {EFFECT_ICONS[a.type]} {t(`actionLabels.effect_${a.type}`, { defaultValue: ACTION_EFFECT_LABELS[a.type] })}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function RuleEditor({
  rule,
  onUpdate,
  onDone,
}: {
  rule: ActionRule
  onUpdate: (updates: Partial<ActionRule>) => void
  onDone: () => void
}) {
  const [name, setName] = useState(rule.name)
  const [conditions, setConditions] = useState<ActionCondition[]>([...rule.conditions])
  const [actions, setActions] = useState<ActionEffect[]>([...rule.actions])
  const { t } = useTranslation()

  const handleSave = () => {
    onUpdate({ name, conditions, actions })
    onDone()
  }

  const addCondition = () => {
    setConditions([...conditions, { field: "entry.title", operator: "contains", value: "" }])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, updates: Partial<ActionCondition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)))
  }

  const toggleAction = (type: ActionEffectType) => {
    if (actions.some((a) => a.type === type)) {
      setActions(actions.filter((a) => a.type !== type))
    } else {
      setActions([...actions, { type }])
    }
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">{t("settings.ruleName")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full px-3 py-1.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">
            {t("settings.conditions")} <span className="text-text-tertiary font-normal">{t("settings.conditionsAll")}</span>
          </label>
          <button onClick={addCondition} className="text-xs text-accent hover:underline flex items-center gap-0.5">
            <Plus size={12} /> {t("settings.addCondition")}
          </button>
        </div>
        <div className="space-y-2">
          {conditions.map((cond, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={cond.field}
                onChange={(e) => updateCondition(i, { field: e.target.value as ConditionField })}
                className="px-2 py-1.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-secondary text-xs focus:outline-none focus:ring-1 focus:ring-accent/50"
              >
                {Object.entries(CONDITION_FIELD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{t(`actionLabels.field_${key.replace(".", "_")}`, { defaultValue: label })}</option>
                ))}
              </select>
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOperator })}
                className="px-2 py-1.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-secondary text-xs focus:outline-none focus:ring-1 focus:ring-accent/50"
              >
                {Object.entries(CONDITION_OPERATOR_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{t(`actionLabels.op_${key}`, { defaultValue: label })}</option>
                ))}
              </select>
              <input
                type="text"
                value={cond.value}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                placeholder={t("settings.matchValue")}
                className="flex-1 px-2 py-1.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-secondary text-xs focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
              <button
                onClick={() => removeCondition(i)}
                className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-2 block">
          {t("settings.performActions")}
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(ACTION_EFFECT_LABELS) as [ActionEffectType, string][]).map(([type, label]) => {
            const isActive = actions.some((a) => a.type === type)
            return (
              <button
                key={type}
                onClick={() => toggleAction(type)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-accent text-white"
                    : "border hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                }`}
              >
                {EFFECT_ICONS[type]}
                {t(`actionLabels.effect_${type}`, { defaultValue: label })}
              </button>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button
          onClick={onDone}
          className="px-3 py-1.5 rounded-lg border text-xs hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
        >
          <Check size={12} />
          {t("common.save")}
        </button>
      </div>
    </div>
  )
}
