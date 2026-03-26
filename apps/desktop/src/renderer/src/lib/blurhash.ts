/**
 * Lightweight blurhash decoder — generates a CSS background from a blurhash string.
 * Blurhash utilities for image placeholder loading.
 */

const digitCharacters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"

function decode83(str: string): number {
  let value = 0
  for (const c of str) {
    const digit = digitCharacters.indexOf(c)
    value = value * 83 + digit
  }
  return value
}

function sRGBToLinear(value: number): number {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function linearToSRGB(value: number): number {
  const v = Math.max(0, Math.min(1, value))
  return v <= 0.0031308
    ? Math.round(v * 12.92 * 255 + 0.5)
    : Math.round((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5)
}

function decodeDC(value: number): [number, number, number] {
  return [
    sRGBToLinear(value >> 16),
    sRGBToLinear((value >> 8) & 255),
    sRGBToLinear(value & 255),
  ]
}

function decodeAC(value: number, maximumValue: number): [number, number, number] {
  const quantR = Math.floor(value / (19 * 19))
  const quantG = Math.floor(value / 19) % 19
  const quantB = value % 19
  return [
    signPow((quantR - 9) / 9, 2.0) * maximumValue,
    signPow((quantG - 9) / 9, 2.0) * maximumValue,
    signPow((quantB - 9) / 9, 2.0) * maximumValue,
  ]
}

function signPow(base: number, exp: number): number {
  return Math.sign(base) * Math.pow(Math.abs(base), exp)
}

/**
 * Decode a blurhash to pixel data (Uint8ClampedArray).
 */
export function decodeBlurhash(blurhash: string, width: number, height: number): Uint8ClampedArray {
  if (!blurhash || blurhash.length < 6) {
    // Return transparent
    return new Uint8ClampedArray(width * height * 4)
  }

  const sizeFlag = decode83(blurhash[0])
  const numY = Math.floor(sizeFlag / 9) + 1
  const numX = (sizeFlag % 9) + 1

  const quantisedMaximumValue = decode83(blurhash[1])
  const maximumValue = (quantisedMaximumValue + 1) / 166

  const colors: Array<[number, number, number]> = new Array(numX * numY)
  colors[0] = decodeDC(decode83(blurhash.substring(2, 6)))

  for (let i = 1; i < numX * numY; i++) {
    colors[i] = decodeAC(
      decode83(blurhash.substring(4 + i * 2, 6 + i * 2)),
      maximumValue,
    )
  }

  const pixels = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0
      for (let j = 0; j < numY; j++) {
        for (let i = 0; i < numX; i++) {
          const basis =
            Math.cos((Math.PI * x * i) / width) *
            Math.cos((Math.PI * y * j) / height)
          const color = colors[i + j * numX]
          r += color[0] * basis
          g += color[1] * basis
          b += color[2] * basis
        }
      }
      const idx = 4 * (x + y * width)
      pixels[idx] = linearToSRGB(r)
      pixels[idx + 1] = linearToSRGB(g)
      pixels[idx + 2] = linearToSRGB(b)
      pixels[idx + 3] = 255
    }
  }

  return pixels
}

/**
 * Decode a blurhash to a data URL for use as image src or background.
 */
export function blurhashToDataURL(blurhash: string, width = 32, height = 32): string {
  if (!blurhash || blurhash.length < 6) return ""
  try {
    const pixels = decodeBlurhash(blurhash, width, height)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return ""
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL()
  } catch {
    return ""
  }
}

/**
 * Get the average color from a blurhash string as a hex color.
 * Useful for simple background placeholders without full decoding.
 */
export function blurhashToAverageColor(blurhash: string): string {
  if (!blurhash || blurhash.length < 6) return "#e5e7eb"
  try {
    const value = decode83(blurhash.substring(2, 6))
    const r = value >> 16
    const g = (value >> 8) & 255
    const b = value & 255
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
  } catch {
    return "#e5e7eb"
  }
}
