import { createElement, type CSSProperties } from 'react'
import { getPartIcon } from '../lib/partIcons'

export function PartIcon({
  name,
  size = 24,
  className,
  strokeWidth = 2,
  style,
}: {
  name: string
  size?: number
  className?: string
  strokeWidth?: number
  style?: CSSProperties
}) {
  return createElement(getPartIcon(name), {
    size,
    strokeWidth,
    className,
    style,
    'aria-hidden': true,
  })
}
