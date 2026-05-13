import { matrix4 } from '@kit.ArkUI'

@Observed
export class ImageModel {
  matrix: matrix4.Matrix4Transit = matrix4.identity().copy()
  curScale: number = 1
  curOffsetX: number = 0
  curOffsetY: number = 0
  lastScale: number = 1
  lastOffsetX: number = 0
  lastOffsetY: number = 0
  readonly minScale: number = 0.5
  maxScale: number = 1
  readonly defaultScaleValue: number = 1
  maxOffsetX: number = 999
  minOffsetX: number = -999
  maxOffsetY: number = 999
  minOffsetY: number = -999
  centerX: number = 0.5
  centerY: number = 0.5
  private center: [number, number] = [0.5, 0.5]
  componentWidth: number = 0
  componentHeight: number = 0
  imageDisplayWidth: number = 0
  imageDisplayHeight: number = 0
  isDisableSwipe: boolean = false
  isArriveBoundary: boolean = false

  gestureEnd(): void {
    this.lastScale = this.curScale
    this.lastOffsetX = this.curOffsetX
    this.lastOffsetY = this.curOffsetY
  }

  imageReset(): void {
    this.matrix = matrix4.identity().scale({ x: this.defaultScaleValue }).copy()
    this.lastScale = this.defaultScaleValue
    this.offsetReset()
  }

  offsetReset(): void {
    this.curOffsetX = 0
    this.curOffsetY = 0
    this.lastOffsetX = 0
    this.lastOffsetY = 0
  }

  pictureScaling(scale: number): void {
    this.matrix = matrix4.identity().scale({ x: scale, y: scale }).copy()
  }

  evaluateOffsetRange(): void {
    const scaledW = this.imageDisplayWidth * this.curScale
    const scaledH = this.imageDisplayHeight * this.curScale
    if (scaledW > this.componentWidth) {
      const maxX = (scaledW - this.componentWidth) / 2
      this.maxOffsetX = maxX
      this.minOffsetX = -maxX
    } else {
      this.maxOffsetX = 0
      this.minOffsetX = 0
    }
    if (scaledH > this.componentHeight) {
      const maxY = (scaledH - this.componentHeight) / 2
      this.maxOffsetY = maxY
      this.minOffsetY = -maxY
    } else {
      this.maxOffsetY = 0
      this.minOffsetY = 0
    }
  }

  evaluateCenter(px: number, py: number): [number, number] {
    const imgW = this.imageDisplayWidth * this.lastScale
    const imgH = this.imageDisplayHeight * this.lastScale
    const imgX = (this.componentWidth - imgW) / 2 + this.lastOffsetX
    const imgY = (this.componentHeight - imgH) / 2 + this.lastOffsetY
    const cX = Math.max((px - imgX) / imgW, 0)
    const cY = Math.max((py - imgY) / imgH, 0)
    return [cX, cY]
  }

  calcFitScaleRatio(imageW: number, imageH: number): number {
    if (imageW <= 0 || imageH <= 0) {
      return 1
    }
    const ratio = Math.max(this.componentWidth / imageW, this.componentHeight / imageH)
    return ratio + 0.5
  }

  onScale(scale: number, offX: number, offY: number): void {
    const newScale = this.lastScale * scale
    if (newScale > this.maxScale) {
      this.curScale = this.maxScale
    } else if (newScale < this.minScale) {
      this.curScale = this.minScale
    } else {
      this.curScale = newScale
    }
    if (this.lastScale * scale === this.maxScale) {
      this.curScale -= 0.001
    }
    this.evaluateOffsetRange()
    if (this.curScale < this.maxScale) {
      this.curOffsetY =
        (this.lastOffsetY + offY) + (0.5 - this.centerY) * this.imageDisplayHeight * (1 - scale) * this.lastScale
      this.curOffsetX =
        (this.lastOffsetX + offX) + (0.5 - this.centerX) * this.imageDisplayWidth * (1 - scale) * this.lastScale
    }
    this.isArriveBoundary = false
    if (!this.isArriveBoundary) {
      this.isDisableSwipe = true
    }
  }

  pictureBoundaryRestriction(): void {
    if (this.curOffsetX > this.maxOffsetX) {
      this.curOffsetX = this.maxOffsetX
      this.isDisableSwipe = false
      this.isArriveBoundary = true
    } else if (this.curOffsetX < this.minOffsetX) {
      this.curOffsetX = this.minOffsetX
      this.isDisableSwipe = false
      this.isArriveBoundary = true
    }
    if (this.curOffsetY > this.maxOffsetY) {
      this.curOffsetY = this.maxOffsetY
    } else if (this.curOffsetY < this.minOffsetY) {
      this.curOffsetY = this.minOffsetY
    }
    const scaledW = this.imageDisplayWidth * this.curScale
    const scaledH = this.imageDisplayHeight * this.curScale
    if (scaledW <= this.componentWidth) {
      this.curOffsetX = 0
    }
    if (scaledH <= this.componentHeight) {
      this.curOffsetY = 0
    }
  }

  panGestureUpdate(event: GestureEvent): boolean {
    this.onScale(event.scale, event.offsetX || 0, event.offsetY || 0)
    this.pictureBoundaryRestriction()
    return this.isDisableSwipe
  }

  pinchGestureStart(event: GestureEvent): void {
    this.center = this.evaluateCenter(event.pinchCenterX, event.pinchCenterY)
    this.centerX = 1 - this.center[0]
    this.centerY = 1 - this.center[1]
  }

  pinchGestureUpdate(event: GestureEvent): boolean {
    this.onScale(event.scale, event.offsetX || 0, event.offsetY || 0)
    this.pictureScaling(this.curScale)
    if (this.curScale > this.defaultScaleValue) {
      this.isDisableSwipe = true
    }
    this.pictureBoundaryRestriction()
    return this.isDisableSwipe
  }

  doubleTapGesture(event: GestureEvent): boolean {
    this.center = this.evaluateCenter(event.fingerList[0].displayX, event.fingerList[0].displayY)
    this.centerX = 1 - this.center[0]
    this.centerY = 1 - this.center[1]
    if (this.lastScale > this.defaultScaleValue) {
      this.pictureScaling(this.defaultScaleValue)
      this.offsetReset()
      this.lastScale = this.defaultScaleValue
      this.isDisableSwipe = false
    } else {
      this.onScale(this.maxScale / this.lastScale, 0, 0)
      this.pictureScaling(this.maxScale)
      this.gestureEnd()
      this.isDisableSwipe = true
    }
    return this.isDisableSwipe
  }
}
