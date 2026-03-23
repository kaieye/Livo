import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Undo2, Redo2, Scissors, Copy, ClipboardPaste, Eraser, CheckSquare } from "lucide-react"
import { useOverlayHotkeyScope } from "../../hooks/useHotkeyScope"

type EditableTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement

type MenuAction = {
  id: string
  label: string
  icon: React.ReactNode
  enabled: boolean
  separator?: boolean
  run: () => void | Promise<void>
}

function getInputSelectionText(el: HTMLInputElement | HTMLTextAreaElement): string {
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  if (end <= start) return ""
  return el.value.slice(start, end)
}

function getEditableFromTarget(target: EventTarget | null): EditableTarget | null {
  if (!(target instanceof Node)) return null
  const start = target instanceof HTMLElement ? target : target.parentElement
  if (!start) return null

  const editableNode = start.closest(
    "input, textarea, [contenteditable='true'], [contenteditable=''], [contenteditable='plaintext-only']",
  )

  if (!(editableNode instanceof HTMLElement)) return null
  if (editableNode instanceof HTMLInputElement || editableNode instanceof HTMLTextAreaElement) {
    return editableNode
  }
  return editableNode.isContentEditable ? editableNode : null
}

function localeText(lang: string, zh: string, en: string): string {
  return lang.toLowerCase().startsWith("zh") ? zh : en
}

export function TextContextMenu() {
  const { i18n } = useTranslation()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<{
    visible: boolean
    x: number
    y: number
    editable: EditableTarget | null
    selectedText: string
    selectScope: HTMLElement | null
  }>({ visible: false, x: 0, y: 0, editable: null, selectedText: "", selectScope: null })
  useOverlayHotkeyScope("context-menu", state.visible)

  const [pos, setPos] = useState({ x: 0, y: 0 })

  const actions = useMemo<MenuAction[]>(() => {
    const lang = i18n.language || "en"
    const editable = state.editable
    const selectScope = state.selectScope
    const selectionText = state.selectedText
    const hasSelection = selectionText.length > 0

    if (!editable && !hasSelection) return []

    const isInput = editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement
    const isReadonlyInput = isInput ? !!editable.readOnly || !!editable.disabled : false
    const canEdit = !!editable && !isReadonlyInput

    const selected = isInput ? getInputSelectionText(editable) : selectionText
    const hasEditableSelection = selected.length > 0

    const menu: MenuAction[] = []

    if (editable) {
      menu.push(
        {
          id: "undo",
          label: localeText(lang, "撤销", "Undo"),
          icon: <Undo2 size={14} />,
          enabled: canEdit,
          run: () => {
            document.execCommand("undo")
          },
        },
        {
          id: "redo",
          label: localeText(lang, "重做", "Redo"),
          icon: <Redo2 size={14} />,
          enabled: canEdit,
          run: () => {
            document.execCommand("redo")
          },
        },
        {
          id: "cut",
          label: localeText(lang, "剪切", "Cut"),
          icon: <Scissors size={14} />,
          enabled: canEdit && hasEditableSelection,
          separator: true,
          run: async () => {
            if (!editable) return
            if (isInput) {
              const text = getInputSelectionText(editable)
              if (!text) return
              try { await navigator.clipboard.writeText(text) } catch {}
              const start = editable.selectionStart ?? 0
              const end = editable.selectionEnd ?? 0
              editable.setRangeText("", start, end, "start")
              editable.dispatchEvent(new Event("input", { bubbles: true }))
              return
            }
            document.execCommand("cut")
          },
        },
        {
          id: "copy",
          label: localeText(lang, "复制", "Copy"),
          icon: <Copy size={14} />,
          enabled: hasEditableSelection,
          run: async () => {
            if (!editable) return
            if (isInput) {
              const text = getInputSelectionText(editable)
              if (!text) return
              try { await navigator.clipboard.writeText(text) } catch {}
              return
            }
            if (selectionText) {
              try { await navigator.clipboard.writeText(selectionText) } catch {}
            }
          },
        },
        {
          id: "paste",
          label: localeText(lang, "粘贴", "Paste"),
          icon: <ClipboardPaste size={14} />,
          enabled: canEdit,
          run: async () => {
            if (!editable || !canEdit) return
            let text = ""
            try { text = await navigator.clipboard.readText() } catch {}
            if (!text) return
            if (isInput) {
              const start = editable.selectionStart ?? 0
              const end = editable.selectionEnd ?? 0
              editable.setRangeText(text, start, end, "end")
              editable.dispatchEvent(new Event("input", { bubbles: true }))
              return
            }
            document.execCommand("insertText", false, text)
          },
        },
        {
          id: "delete",
          label: localeText(lang, "删除", "Delete"),
          icon: <Eraser size={14} />,
          enabled: canEdit && hasEditableSelection,
          run: () => {
            if (!editable || !canEdit) return
            if (isInput) {
              const start = editable.selectionStart ?? 0
              const end = editable.selectionEnd ?? 0
              if (end <= start) return
              editable.setRangeText("", start, end, "start")
              editable.dispatchEvent(new Event("input", { bubbles: true }))
              return
            }
            document.execCommand("delete")
          },
        },
        {
          id: "select-all",
          label: localeText(lang, "全选", "Select All"),
          icon: <CheckSquare size={14} />,
          enabled: true,
          separator: true,
          run: () => {
            if (!editable) return
            if (isInput) {
              editable.select()
              return
            }
            document.execCommand("selectAll")
          },
        },
      )
      return menu
    }

    menu.push(
      {
        id: "copy",
        label: localeText(lang, "复制", "Copy"),
        icon: <Copy size={14} />,
        enabled: hasSelection,
        run: async () => {
          if (!selectionText) return
          try { await navigator.clipboard.writeText(selectionText) } catch {}
        },
      },
      {
        id: "select-all",
        label: localeText(lang, "全选", "Select All"),
        icon: <CheckSquare size={14} />,
        enabled: true,
        run: () => {
          if (selectScope) {
            const selection = window.getSelection()
            if (!selection) return
            selection.removeAllRanges()
            const range = document.createRange()
            range.selectNodeContents(selectScope)
            selection.addRange(range)
            return
          }
          document.execCommand("selectAll")
        },
      },
    )
    return menu
  }, [state.editable, state.selectedText, state.selectScope, i18n.language])

  useEffect(() => {
    if (!state.visible) return
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = state.x + rect.width > window.innerWidth ? Math.max(6, window.innerWidth - rect.width - 6) : state.x
    const y = state.y + rect.height > window.innerHeight ? Math.max(6, window.innerHeight - rect.height - 6) : state.y
    setPos({ x, y })
  }, [state.visible, state.x, state.y, actions.length])

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const editable = getEditableFromTarget(e.target)
      const targetEl = e.target instanceof HTMLElement ? e.target : e.target instanceof Node ? (e.target.parentElement as HTMLElement | null) : null
      const selection = window.getSelection?.()?.toString().trim() || ""
      const isInput = editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement
      const inputSelection = isInput ? getInputSelectionText(editable) : ""
      const selectedText = inputSelection || selection
      const selectScope =
        targetEl?.closest("[data-context-select-scope]") as HTMLElement | null ||
        targetEl?.closest("article") as HTMLElement | null ||
        targetEl?.closest(".entry-content") as HTMLElement | null ||
        null

      if (!editable && !selectedText) return

      if (editable && editable instanceof HTMLElement) editable.focus()

      e.preventDefault()
      e.stopPropagation()
      setState({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        editable,
        selectedText,
        selectScope,
      })
    }

    const close = () => setState((s) => ({ ...s, visible: false }))
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }

    document.addEventListener("contextmenu", onContextMenu)
    document.addEventListener("mousedown", close)
    document.addEventListener("scroll", close, true)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("contextmenu", onContextMenu)
      document.removeEventListener("mousedown", close)
      document.removeEventListener("scroll", close, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  if (!state.visible || actions.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-[110] min-w-[210px] rounded-xl border bg-white dark:bg-surface-dark shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="py-1">
        {actions.map((action, i) => (
          <div key={action.id}>
            {action.separator && i > 0 && (
              <div className="h-px bg-border dark:bg-surface-dark-tertiary my-1" />
            )}
            <button
              onClick={async () => {
                if (!action.enabled) return
                await action.run()
                setState((s) => ({ ...s, visible: false }))
              }}
              disabled={!action.enabled}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                action.enabled
                  ? "hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                  : "opacity-40 cursor-not-allowed"
              }`}
            >
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-text-secondary dark:text-text-dark-secondary">
                {action.icon}
              </span>
              <span className="text-text-primary dark:text-text-dark-primary">{action.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
