import { media } from '@kit.MediaKit'
import { audio } from '@kit.AudioKit'
import { avSession } from '@kit.AVSessionKit'
// TODO: BackgroundTaskKit 在 SDK 6.1.0(23) 中不可用，暂时注释
// import { backgroundTaskManager } from '@kit.BackgroundTaskKit'
import { AppContextService } from './AppContextService'

const AUDIO_REQUEST_USER_AGENT: string =
  'Mozilla/5.0 (Linux; OpenHarmony) AppleWebKit/537.36 (KHTML, like Gecko) Livo/1.0 Mobile Safari/537.36'

const AUDIO_SERVICE_PLAYING = 'audioServicePlaying'
const AUDIO_SERVICE_PREPARING = 'audioServicePreparing'
const AUDIO_SERVICE_TRACK_TITLE = 'audioServiceTrackTitle'
const AUDIO_SERVICE_TRACK_URL = 'audioServiceTrackUrl'
const AUDIO_SERVICE_POSITION_MS = 'audioServicePositionMs'
const AUDIO_SERVICE_DURATION_MS = 'audioServiceDurationMs'
const AUDIO_SERVICE_ERROR = 'audioServiceError'
const AUDIO_SERVICE_ACTIVE = 'audioServiceActive'
const AUDIO_SERVICE_SHOULD_SHOW = 'audioServiceShouldShow'
const AUDIO_PLAYER_COLLAPSED = 'audioPlayerCollapsed'
const AUDIO_SERVICE_SPEED = 'audioServiceSpeed'

const DEFAULT_PLAYBACK_SPEED: number = 1.0
const SUPPORTED_PLAYBACK_SPEEDS: number[] = [1.0, 1.25, 1.5, 2.0, 0.75]

function resolvePlaybackSpeedEnum(rate: number): media.PlaybackSpeed {
  if (rate <= 0.75) {
    return media.PlaybackSpeed.SPEED_FORWARD_0_75_X
  }
  if (rate <= 1.0) {
    return media.PlaybackSpeed.SPEED_FORWARD_1_00_X
  }
  if (rate <= 1.25) {
    return media.PlaybackSpeed.SPEED_FORWARD_1_25_X
  }
  if (rate <= 1.5) {
    return media.PlaybackSpeed.SPEED_FORWARD_1_50_X
  }
  if (rate <= 1.75) {
    return media.PlaybackSpeed.SPEED_FORWARD_1_75_X
  }
  return media.PlaybackSpeed.SPEED_FORWARD_2_00_X
}

function initAppStorageDefaults(): void {
  if (!AppStorage.get<boolean>(AUDIO_SERVICE_PLAYING)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_PLAYING, false)
  }
  if (!AppStorage.get<boolean>(AUDIO_SERVICE_PREPARING)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_PREPARING, false)
  }
  if (!AppStorage.get<string>(AUDIO_SERVICE_TRACK_TITLE)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_TRACK_TITLE, '')
  }
  if (!AppStorage.get<string>(AUDIO_SERVICE_TRACK_URL)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_TRACK_URL, '')
  }
  if (!AppStorage.get<number>(AUDIO_SERVICE_POSITION_MS)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_POSITION_MS, 0)
  }
  if (!AppStorage.get<number>(AUDIO_SERVICE_DURATION_MS)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_DURATION_MS, 0)
  }
  if (!AppStorage.get<string>(AUDIO_SERVICE_ERROR)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_ERROR, '')
  }
  if (!AppStorage.get<boolean>(AUDIO_SERVICE_ACTIVE)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_ACTIVE, false)
  }
  if (!AppStorage.get<boolean>(AUDIO_SERVICE_SHOULD_SHOW)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_SHOULD_SHOW, false)
  }
  if (AppStorage.get<boolean>(AUDIO_PLAYER_COLLAPSED) === undefined) {
    AppStorage.setOrCreate(AUDIO_PLAYER_COLLAPSED, false)
  }
  if (!AppStorage.get<number>(AUDIO_SERVICE_SPEED)) {
    AppStorage.setOrCreate(AUDIO_SERVICE_SPEED, DEFAULT_PLAYBACK_SPEED)
  }
}

function audioRequestHeaders(): Record<string, string> {
  return {
    'User-Agent': AUDIO_REQUEST_USER_AGENT,
    'Accept': 'audio/mpeg,audio/mp4,audio/aac,audio/*;q=0.9,*/*;q=0.8',
  }
}

async function waitForPlayerState(
  player: media.AVPlayer,
  expectedStates: string[],
  timeoutMs: number,
): Promise<void> {
  if (expectedStates.includes(player.state)) {
    return
  }

  return new Promise<void>((resolve, reject) => {
    let finished = false
    let timer: number = 0
    const onStateChange = (state: media.AVPlayerState, _reason: media.StateChangeReason): void => {
      if (finished) {
        return
      }
      if (expectedStates.includes(state)) {
        finished = true
        clearTimeout(timer)
        player.off('stateChange', onStateChange)
        resolve()
        return
      }
      if (state === 'error' || state === 'released') {
        finished = true
        clearTimeout(timer)
        player.off('stateChange', onStateChange)
        reject(new Error(`播放器进入 ${state} 状态`))
      }
    }

    timer = setTimeout(() => {
      if (finished) {
        return
      }
      finished = true
      player.off('stateChange', onStateChange)
      reject(new Error(`等待播放器状态超时，当前状态：${player.state}`))
    }, timeoutMs)

    player.on('stateChange', onStateChange)
  })
}

export class AudioPlaybackService {
  private static instance: AudioPlaybackService | undefined

  private player: media.AVPlayer | undefined = undefined
  private playerUrl: string = ''
  private avSessionHandle: avSession.AVSession | undefined = undefined
  private sessionReady: boolean = false
  // TODO: 后台任务相关代码暂时注释，因为 BackgroundTaskKit 在 SDK 23 中不可用
  // private backgroundTaskHandle: backgroundTaskManager.BackgroundTaskHandle | undefined = undefined

  constructor() {
    initAppStorageDefaults()
  }

  static getInstance(): AudioPlaybackService {
    if (!AudioPlaybackService.instance) {
      AudioPlaybackService.instance = new AudioPlaybackService()
    }
    return AudioPlaybackService.instance
  }

  private setAppStorage(key: string, value: boolean | string | number): void {
    AppStorage.setOrCreate(key, value)
  }

  get isPlaying(): boolean {
    return AppStorage.get<boolean>(AUDIO_SERVICE_PLAYING) ?? false
  }

  private ensureAvSession(): void {
    if (this.sessionReady || this.avSessionHandle) {
      return
    }
    try {
      const ctx = AppContextService.getContext()
      avSession.createAVSession(ctx, 'LivoAudio', 'audio').then((session: avSession.AVSession) => {
        this.avSessionHandle = session
        this.sessionReady = true
        this.bindAvSessionCommands(session)
        
        session.activate().then(() => {
          console.info('[AudioService] AVSession activated')
        }).catch((err: Error) => {
          console.warn(`[AudioService] AVSession activation failed: ${err.message}`)
        })
        
        console.info('[AudioService] AVSession created')
      }).catch((err: Error) => {
        console.warn(`[AudioService] AVSession creation failed: ${err.message}`)
      })
    } catch (err) {
      console.warn(`[AudioService] AVSession unavailable: ${err instanceof Error ? err.message : err}`)
    }
  }

  private bindAvSessionCommands(session: avSession.AVSession): void {
    session.on('play', () => {
      void this.resume()
    })
    session.on('pause', () => {
      void this.pause()
    })
    session.on('stop', () => {
      this.stop()
    })
    session.on('seek', (seekTimeMs: number) => {
      if (this.player) {
        try {
          this.player.seek(seekTimeMs)
        } catch (err) {
          console.warn(`[AudioService] AVSession seek failed: ${err instanceof Error ? err.message : err}`)
        }
      }
    })
  }

  private updateAvSessionPlaybackState(): void {
    if (!this.avSessionHandle || !this.sessionReady) {
      return
    }
    try {
      const playing = this.isPlaying
      const pos = AppStorage.get<number>(AUDIO_SERVICE_POSITION_MS) ?? 0
      this.avSessionHandle.setAVPlaybackState({
        state: playing
          ? avSession.PlaybackState.PLAYBACK_STATE_PLAY
          : avSession.PlaybackState.PLAYBACK_STATE_PAUSE,
        position: {
          elapsedTime: pos,
          updateTime: Date.now(),
        },
      })
    } catch (err) {
      console.warn(`[AudioService] AVSession state update failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  private updateAvSessionMetadata(title: string, durationMs: number): void {
    if (!this.avSessionHandle || !this.sessionReady) {
      return
    }
    try {
      this.avSessionHandle.setAVMetadata({
        assetId: this.playerUrl,
        title: title,
        artist: 'Livo',
        duration: durationMs,
      })
    } catch (err) {
      console.warn(`[AudioService] AVSession metadata update failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  private bindPlayerEvents(player: media.AVPlayer): void {
    player.on('stateChange', (state: string) => {
      if (this.player !== player) {
        return
      }
      const playing = state === 'playing'
      this.setAppStorage(AUDIO_SERVICE_PLAYING, playing)
      if (state === 'prepared' || state === 'playing' || state === 'paused' || state === 'completed') {
        this.setAppStorage(AUDIO_SERVICE_PREPARING, false)
        this.setAppStorage(AUDIO_SERVICE_ERROR, '')
      }
      if (state === 'completed') {
        const duration = AppStorage.get<number>(AUDIO_SERVICE_DURATION_MS) ?? 0
        this.setAppStorage(AUDIO_SERVICE_POSITION_MS, duration)
      }
      this.updateAvSessionPlaybackState()
    })
    player.on('durationUpdate', (duration: number) => {
      if (this.player !== player) {
        return
      }
      this.setAppStorage(AUDIO_SERVICE_DURATION_MS, Math.max(0, duration || 0))
      const title = AppStorage.get<string>(AUDIO_SERVICE_TRACK_TITLE) ?? ''
      this.updateAvSessionMetadata(title, Math.max(0, duration || 0))
    })
    player.on('timeUpdate', (time: number) => {
      if (this.player !== player) {
        return
      }
      this.setAppStorage(AUDIO_SERVICE_POSITION_MS, Math.max(0, time || 0))
    })
    player.on('error', () => {
      if (this.player !== player) {
        return
      }
      const wasPreparing: boolean = AppStorage.get<boolean>(AUDIO_SERVICE_PREPARING) ?? false
      this.setAppStorage(AUDIO_SERVICE_PLAYING, false)
      if (!wasPreparing) {
        this.setAppStorage(AUDIO_SERVICE_PREPARING, false)
        this.setAppStorage(AUDIO_SERVICE_ERROR, '音频加载失败')
      }
      console.warn('[AudioService] playback error')
    })
  }

  private configurePlayer(player: media.AVPlayer): void {
    this.bindPlayerEvents(player)
    player.audioRendererInfo = {
      usage: audio.StreamUsage.STREAM_USAGE_MUSIC,
      rendererFlags: 0,
    }
  }

  private releasePlayer(): void {
    const player = this.player
    this.player = undefined
    this.playerUrl = ''
    this.setAppStorage(AUDIO_SERVICE_PLAYING, false)
    this.setAppStorage(AUDIO_SERVICE_PREPARING, false)
    if (player) {
      try {
        void player.release()
      } catch (err) {
        console.warn(`[AudioService] release failed: ${err instanceof Error ? err.message : err}`)
      }
    }
    void this.stopBackgroundTask()
  }

  private async prepareWithDirectUrl(player: media.AVPlayer, sourceUrl: string): Promise<boolean> {
    try {
      player.url = sourceUrl
      await waitForPlayerState(player, ['initialized'], 8000)
      await player.prepare()
      await waitForPlayerState(player, ['prepared'], 15000)
      return true
    } catch (err) {
      console.warn(`[AudioService] direct url prepare failed: ${err instanceof Error ? err.message : err}`)
      return false
    }
  }

  private async prepareWithMediaSource(player: media.AVPlayer, sourceUrl: string): Promise<boolean> {
    try {
      const mediaSource = media.createMediaSourceWithUrl(sourceUrl, audioRequestHeaders())
      await player.setMediaSource(mediaSource)
      await waitForPlayerState(player, ['initialized'], 8000)
      await player.prepare()
      await waitForPlayerState(player, ['prepared'], 15000)
      return true
    } catch (err) {
      console.warn(`[AudioService] media source prepare failed: ${err instanceof Error ? err.message : err}`)
      return false
    }
  }

  private async ensurePlayer(sourceUrl: string): Promise<media.AVPlayer | undefined> {
    if (!sourceUrl) {
      return undefined
    }
    if (this.player && this.playerUrl === sourceUrl) {
      return this.player
    }

    this.releasePlayer()
    this.setAppStorage(AUDIO_SERVICE_PREPARING, true)
    this.setAppStorage(AUDIO_SERVICE_ERROR, '')

    try {
      let player = await media.createAVPlayer()
      this.player = player
      this.playerUrl = sourceUrl
      this.configurePlayer(player)
      if (await this.prepareWithDirectUrl(player, sourceUrl)) {
        return player
      }

      this.player = undefined
      try {
        await player.release()
      } catch (err) {
        console.warn(`[AudioService] release before fallback failed: ${err instanceof Error ? err.message : err}`)
      }
      player = await media.createAVPlayer()
      this.player = player
      this.playerUrl = sourceUrl
      this.configurePlayer(player)
      if (await this.prepareWithMediaSource(player, sourceUrl)) {
        return player
      }
      this.releasePlayer()
      this.setAppStorage(AUDIO_SERVICE_ERROR, '音频加载失败')
      return undefined
    } catch (err) {
      this.releasePlayer()
      this.setAppStorage(AUDIO_SERVICE_ERROR, '音频加载失败')
      console.warn(`[AudioService] prepare failed: ${err instanceof Error ? err.message : err}`)
      return undefined
    } finally {
      this.setAppStorage(AUDIO_SERVICE_PREPARING, false)
    }
  }

  async start(url: string, title: string): Promise<void> {
    initAppStorageDefaults()
    this.setAppStorage(AUDIO_SERVICE_TRACK_TITLE, title)
    this.setAppStorage(AUDIO_SERVICE_TRACK_URL, url)
    this.setAppStorage(AUDIO_SERVICE_ACTIVE, true)
    this.setAppStorage(AUDIO_SERVICE_SHOULD_SHOW, true)
    this.setAppStorage(AUDIO_PLAYER_COLLAPSED, false)
    this.setAppStorage(AUDIO_SERVICE_POSITION_MS, 0)
    this.setAppStorage(AUDIO_SERVICE_DURATION_MS, 0)

    this.ensureAvSession()

    const player = await this.ensurePlayer(url)
    if (!player) {
      this.setAppStorage(AUDIO_SERVICE_ACTIVE, false)
      return
    }
    try {
      await player.play()
      this.setAppStorage(AUDIO_SERVICE_PLAYING, true)
      const speed = AppStorage.get<number>(AUDIO_SERVICE_SPEED) ?? DEFAULT_PLAYBACK_SPEED
      if (Math.abs(speed - DEFAULT_PLAYBACK_SPEED) > 0.001) {
        try {
          player.setSpeed(resolvePlaybackSpeedEnum(speed))
        } catch (err) {
          console.warn(`[AudioService] initial setSpeed failed: ${err instanceof Error ? err.message : err}`)
        }
      }
      void this.startBackgroundTask()
    } catch (err) {
      this.setAppStorage(AUDIO_SERVICE_ERROR, '音频播放失败')
      this.setAppStorage(AUDIO_SERVICE_PLAYING, false)
      console.warn(`[AudioService] play failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  async pause(): Promise<void> {
    if (!this.player || !this.isPlaying) {
      return
    }
    try {
      await this.player.pause()
      this.setAppStorage(AUDIO_SERVICE_PLAYING, false)
      this.updateAvSessionPlaybackState()
    } catch (err) {
      console.warn(`[AudioService] pause failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  async resume(): Promise<void> {
    if (!this.player || this.isPlaying) {
      return
    }
    try {
      const durationMs = AppStorage.get<number>(AUDIO_SERVICE_DURATION_MS) ?? 0
      const positionMs = AppStorage.get<number>(AUDIO_SERVICE_POSITION_MS) ?? 0
      if (durationMs > 0 && positionMs >= durationMs) {
        this.player.seek(0)
        this.setAppStorage(AUDIO_SERVICE_POSITION_MS, 0)
      }
      await this.player.play()
      this.setAppStorage(AUDIO_SERVICE_PLAYING, true)
      this.updateAvSessionPlaybackState()
    } catch (err) {
      this.setAppStorage(AUDIO_SERVICE_ERROR, '音频播放失败')
      this.setAppStorage(AUDIO_SERVICE_PLAYING, false)
      console.warn(`[AudioService] resume failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  seekTo(positionMs: number): void {
    if (!this.player) {
      return
    }
    const durationMs = AppStorage.get<number>(AUDIO_SERVICE_DURATION_MS) ?? 0
    const clamped = durationMs > 0
      ? Math.max(0, Math.min(durationMs, positionMs))
      : Math.max(0, positionMs)
    try {
      this.player.seek(clamped)
      this.setAppStorage(AUDIO_SERVICE_POSITION_MS, clamped)
      this.updateAvSessionPlaybackState()
    } catch (err) {
      console.warn(`[AudioService] seek failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  cyclePlaybackSpeed(): number {
    const current = AppStorage.get<number>(AUDIO_SERVICE_SPEED) ?? DEFAULT_PLAYBACK_SPEED
    const index = SUPPORTED_PLAYBACK_SPEEDS.findIndex((s) => Math.abs(s - current) < 0.001)
    const nextIndex = index < 0 ? 0 : (index + 1) % SUPPORTED_PLAYBACK_SPEEDS.length
    const next = SUPPORTED_PLAYBACK_SPEEDS[nextIndex]
    this.applyPlaybackSpeed(next)
    return next
  }

  applyPlaybackSpeed(rate: number): void {
    this.setAppStorage(AUDIO_SERVICE_SPEED, rate)
    if (!this.player) {
      return
    }
    try {
      this.player.setSpeed(resolvePlaybackSpeedEnum(rate))
    } catch (err) {
      console.warn(`[AudioService] setSpeed failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  stop(): void {
    this.setAppStorage(AUDIO_SERVICE_SHOULD_SHOW, false)
    this.setAppStorage(AUDIO_SERVICE_ACTIVE, false)
    this.releasePlayer()
    this.releaseAvSession()
    void this.stopBackgroundTask()
  }

  private releaseAvSession(): void {
    if (this.avSessionHandle) {
      try {
        void this.avSessionHandle.destroy()
      } catch (err) {
        console.warn(`[AudioService] AVSession destroy failed: ${err instanceof Error ? err.message : err}`)
      }
      this.avSessionHandle = undefined
      this.sessionReady = false
    }
  }

  // TODO: 后台任务相关代码暂时注释
  private async startBackgroundTask(): Promise<void> {
    // if (this.backgroundTaskHandle) {
    //   return
    // }
    // try {
    //   const ctx = AppContextService.getContext()
    //   const request: backgroundTaskManager.TransientTaskRequest = {
    //     type: backgroundTaskManager.TaskType.TRANSIENT_TASK,
    //     timeout: 3600000,
    //   }
    //   this.backgroundTaskHandle = await backgroundTaskManager.startBackgroundTask(ctx, request)
    //   console.info('[AudioService] Background task started')
    // } catch (err) {
    //   console.warn(`[AudioService] Failed to start background task: ${err instanceof Error ? err.message : err}`)
    // }
  }

  private async stopBackgroundTask(): Promise<void> {
    // if (!this.backgroundTaskHandle) {
    //   return
    // }
    // try {
    //   await backgroundTaskManager.stopBackgroundTask(this.backgroundTaskHandle)
    //   this.backgroundTaskHandle = undefined
    //   console.info('[AudioService] Background task stopped')
    // } catch (err) {
    //   console.warn(`[AudioService] Failed to stop background task: ${err instanceof Error ? err.message : err}`)
    // }
  }

  togglePlayback(url: string, title: string): void {
    if (this.playerUrl === url && this.isPlaying) {
      void this.pause()
    } else if (this.playerUrl === url && this.player) {
      void this.resume()
    } else {
      void this.start(url, title)
    }
  }

  release(): void {
    this.stop()
    AudioPlaybackService.instance = undefined
  }
}
