import clsx from 'clsx'

const logoUrl = `url(${import.meta.env.BASE_URL}logo.svg)`

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
