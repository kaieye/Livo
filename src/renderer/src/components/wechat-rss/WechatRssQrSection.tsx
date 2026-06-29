import { QrCode, RefreshCw, Smartphone } from 'lucide-react'
import type { WechatQrStatus } from '../../lib/wechat-rss-api'

interface Props {
  status: WechatQrStatus
  qrImageUrl: string
  onGenerateQr: () => void
}

export function WechatRssQrSection({
  status,
  qrImageUrl,
  onGenerateQr,
}: Props) {
  const hasQr = !!qrImageUrl

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
        {hasQr ? (
          <Smartphone className="h-10 w-10 text-[#07C160]" />
        ) : (
          <QrCode className="h-10 w-10 text-neutral-400" />
        )}
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {hasQr ? '请用微信扫码' : '扫码授权微信'}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {hasQr
            ? '打开微信扫描下方二维码后自动登录'
            : '点击下方按钮生成微信登录二维码'}
        </p>
      </div>

      {/* QR Code Image */}
      {hasQr && (
        <div className="rounded-xl border-2 border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <img
            src={qrImageUrl}
            alt="微信二维码"
            className="h-56 w-56 rounded-lg"
          />
        </div>
      )}

      {/* Generate Button */}
      {!hasQr && (
        <button
          onClick={onGenerateQr}
          disabled={status.qrPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[#07C160] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#06AD56] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${status.qrPending ? 'animate-spin' : ''}`}
          />
          {status.qrPending ? '正在生成...' : '生成二维码'}
        </button>
      )}

      {/* Status text */}
      {status.qrPending && !hasQr && (
        <p className="text-xs text-neutral-400">正在连接微信服务器...</p>
      )}
    </div>
  )
}
