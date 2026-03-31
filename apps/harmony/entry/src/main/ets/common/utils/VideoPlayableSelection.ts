export interface InvidiousFormatStream {
  url?: string
  type?: string
  quality?: string
  container?: string
  resolution?: string
}

export interface PipedStream {
  url?: string
  quality?: string
  mimeType?: string
  videoOnly?: boolean
}

function qualityValue(label: string): number {
  const matched = (label || '').match(/(\d+)/)
  return matched?.[1] ? Number(matched[1]) : 0
}

export function selectInvidiousPlayableUrl(
  formatStreams: InvidiousFormatStream[],
): string {
  if (!formatStreams || formatStreams.length === 0) {
    return ''
  }

  const mp4Streams = formatStreams
    .filter(
      (item: InvidiousFormatStream) =>
        item.container === 'mp4' || `${item.type ?? ''}`.includes('video/mp4'),
    )
    .sort(
      (left: InvidiousFormatStream, right: InvidiousFormatStream) =>
        qualityValue(right.quality ?? right.resolution ?? '') -
        qualityValue(left.quality ?? left.resolution ?? ''),
    )

  const best = mp4Streams[0] ?? formatStreams[0]
  return best?.url || ''
}

export function selectPipedPlayableUrl(
  hls: string,
  videoStreams: PipedStream[],
): string {
  if (hls) {
    return hls
  }

  if (!videoStreams || videoStreams.length === 0) {
    return ''
  }

  const combined = videoStreams
    .filter(
      (item: PipedStream) =>
        item.videoOnly !== true &&
        `${item.mimeType ?? ''}`.includes('video/mp4'),
    )
    .sort(
      (left: PipedStream, right: PipedStream) =>
        qualityValue(right.quality ?? '') - qualityValue(left.quality ?? ''),
    )

  return combined[0]?.url || ''
}
