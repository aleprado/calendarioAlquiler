import type { FC } from 'react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export const Logo: FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const dimensions = size === 'sm' ? 32 : size === 'md' ? 44 : 64

  return (
    <div className={`app-logo app-logo--${size} ${className}`}>
      <img
        src="/logo-vacacional.svg"
        alt="Simple Alquiler"
        width={dimensions}
        height={dimensions}
        className="app-logo__img"
      />
      {showText && (
        <span className="app-logo__text">
          simplealquiler<span className="app-logo__dot">.net</span>
        </span>
      )}
    </div>
  )
}
