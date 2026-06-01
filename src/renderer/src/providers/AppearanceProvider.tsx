import { type PropsWithChildren } from 'react'
import { useApplyAppearanceSettings } from '../hooks/useApplyAppearanceSettings'

export function AppearanceProvider({ children }: PropsWithChildren) {
  useApplyAppearanceSettings()
  return children
}
