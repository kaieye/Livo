import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('AI assistant settings panel derives provider options from full provider map', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/AIAssistantSettingsPanel.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /private readonly providerOrder: AIProvider\[] = \[/)
  assert.match(
    source,
    /private providerOptions\(\): SelectOption\[] \{\s*return this\.providerOrder\.map\(\(provider: AIProvider\): SelectOption => \(\{\s*label: this\.providerDefinition\(provider\)\.label,\s*value: provider,\s*\}\)\)\s*\}/s,
  )
})

test('AI assistant provider normalization no longer hardcodes deepseek fallback', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/AIAssistantSettingsPanel.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(
    source,
    /private normalizeProvider\(provider: AIProvider\): AIProvider \{\s*return this\.providerOrder\.includes\(provider\) \? provider : DEFAULT_AI_ASSISTANT_SETTINGS\.provider\s*\}/s,
  )
  assert.match(
    source,
    /private providerDefinition\(provider: AIProvider\): AIProviderDefinition \{\s*const normalizedProvider = this\.normalizeProvider\(provider\)\s*switch \(normalizedProvider\) \{[\s\S]*case 'openai':[\s\S]*case 'custom':[\s\S]*default:[\s\S]*\}\s*\}/s,
  )
})

test('AI assistant action row labels are synchronized from selection state', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/AIAssistantSettingsPanel.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(
    source,
    /Text\(this\.providerDefinition\(this\.providerSelection as AIProvider\)\.label\)\s*\.fontSize\(PANEL_HINT_SIZE\)/s,
  )
  assert.match(
    source,
    /Text\(this\.modelSelection\)\s*\.fontSize\(PANEL_HINT_SIZE\)/s,
  )
})
