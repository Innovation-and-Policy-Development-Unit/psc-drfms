import clsx from 'clsx'
// Imported (not served from /public) so the URL carries a content hash: a new design is never masked by a cached old file
import logoFile from '@/assets/logo.svg?url'

// Quoted: Vite inlines a small SVG as a data: URI that contains quote characters
const logoUrl = `url("${logoFile}")`

export default function Logo({ size = 32, className = '' }) {
  return (
    <div
      className={clsx('shrink-0 bg-primary-500 dark:bg-slate-300', className)}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: logoUrl,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskImage: logoUrl,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  )
}
