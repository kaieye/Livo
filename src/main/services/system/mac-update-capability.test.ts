import { describe, expect, it } from 'vitest'
import {
  findMacAppBundlePath,
  isEligibleMacUpdateSignature,
} from './mac-update-capability'

describe('macOS in-place update capability', () => {
  it('finds the containing app bundle from the packaged executable path', () => {
    expect(
      findMacAppBundlePath('/Applications/Livo.app/Contents/MacOS/Livo'),
    ).toBe('/Applications/Livo.app')
    expect(findMacAppBundlePath('/usr/local/bin/livo')).toBeNull()
  })

  it('rejects ad-hoc signatures because each build gets a different requirement', () => {
    expect(
      isEligibleMacUpdateSignature(`
Identifier=com.livospace.cn
Signature=adhoc
TeamIdentifier=not set
`),
    ).toBe(false)
  })

  it('accepts a Developer ID Application signature with a team identifier', () => {
    expect(
      isEligibleMacUpdateSignature(`
Identifier=com.livospace.cn
Authority=Developer ID Application: Livo Inc. (ABCDE12345)
Authority=Developer ID Certification Authority
TeamIdentifier=ABCDE12345
`),
    ).toBe(true)
  })
})
