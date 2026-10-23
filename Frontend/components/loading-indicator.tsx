import { useId } from 'react'

type LoadingIndicatorProps = {
  message: string
  className?: string
  compact?: boolean
  heading?: boolean
}

export function LoadingIndicator({ message, className = '', compact = false, heading = false }: LoadingIndicatorProps) {
  const clipId = useId().replace(/:/g, '')
  const Message = heading ? 'h1' : 'span'
  const classes = ['dove-loading', compact ? 'dove-loading--compact' : '', className].filter(Boolean).join(' ')

  return (
    <div className={classes} role="status" aria-live="polite" aria-atomic="true">
      <svg className="dove-loading-art" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
        <g className="dove-loading-rays" fill="currentColor">
          <g className="dove-loading-ray">
            <path className="dove-loading-ray-aura" d="M53.01 74.34 C44.4 81.34 16.52 103.36 7.67 109.96 A7 7 0 0 1 0.33 98.04 C10.22 93.12 42.46 78.18 52.59 73.66 Z" />
            <path className="dove-loading-ray-core" d="M53.01 74.34 C43.95 80.61 14.78 100.54 5.62 106.64 A3.1 3.1 0 0 1 2.38 101.36 C11.96 95.94 42.91 78.91 52.59 73.66 Z" />
          </g>
          <g className="dove-loading-ray">
            <path className="dove-loading-ray-aura" d="M54.17 74.3 C47.02 82.78 33.18 101.03 25.72 109.17 A7 7 0 0 1 16.28 98.83 C25.08 92.15 44.52 80.04 53.63 73.7 Z" />
            <path className="dove-loading-ray-core" d="M54.17 74.3 C46.44 82.15 30.94 98.58 23.09 106.29 A3.1 3.1 0 0 1 18.91 101.71 C27.31 94.6 45.1 80.68 53.63 73.7 Z" />
          </g>
          <g className="dove-loading-ray">
            <path className="dove-loading-ray-aura" d="M55.35 74.2 C51.19 84.48 48.65 97.39 44.09 107.45 A7 7 0 0 1 31.91 100.55 C38.19 91.47 47.97 82.66 54.65 73.8 Z" />
            <path className="dove-loading-ray-core" d="M55.35 74.2 C50.44 84.06 45.77 95.76 40.7 105.53 A3.1 3.1 0 0 1 35.3 102.47 C41.08 93.1 48.71 83.08 54.65 73.8 Z" />
          </g>
          <g className="dove-loading-ray">
            <path className="dove-loading-ray-aura" d="M56.4 74 C57.85 85 62.01 93 63 104 A7 7 0 0 1 49 104 C49.99 93 54.15 85 55.6 74 Z" />
            <path className="dove-loading-ray-core" d="M56.4 74 C56.99 85 58.7 93 59.1 104 A3.1 3.1 0 0 1 52.9 104 C53.3 93 55.01 85 55.6 74 Z" />
          </g>
          <g className="dove-loading-ray">
            <path className="dove-loading-ray-aura" d="M57.35 73.8 C64.03 82.66 73.81 91.47 80.09 100.55 A7 7 0 0 1 67.91 107.45 C63.35 97.39 60.81 84.48 56.65 74.2 Z" />
            <path className="dove-loading-ray-core" d="M57.35 73.8 C63.29 83.08 70.92 93.1 76.7 102.47 A3.1 3.1 0 0 1 71.3 105.53 C66.23 95.76 61.56 84.06 56.65 74.2 Z" />
          </g>
          <g className="dove-loading-ray">
            <path className="dove-loading-ray-aura" d="M58.37 73.7 C67.48 80.04 86.92 92.15 95.72 98.83 A7 7 0 0 1 86.28 109.17 C78.82 101.03 64.98 82.78 57.83 74.3 Z" />
            <path className="dove-loading-ray-core" d="M58.37 73.7 C66.9 80.68 84.69 94.6 93.09 101.71 A3.1 3.1 0 0 1 88.91 106.29 C81.06 98.58 65.56 82.15 57.83 74.3 Z" />
          </g>
          <g className="dove-loading-ray">
            <path className="dove-loading-ray-aura" d="M59.41 73.66 C69.54 78.18 101.78 93.12 111.67 98.04 A7 7 0 0 1 104.33 109.96 C95.48 103.36 67.6 81.34 58.99 74.34 Z" />
            <path className="dove-loading-ray-core" d="M59.41 73.66 C69.09 78.91 100.04 95.94 109.62 101.36 A3.1 3.1 0 0 1 106.38 106.64 C97.22 100.54 68.05 80.61 58.99 74.34 Z" />
          </g>
        </g>
        <svg className="dove-loading-pigeon" x="0" y="0" width="112" height="75" viewBox="0 0 382 307" preserveAspectRatio="xMidYMid meet" overflow="visible">
          <defs>
            <clipPath id={`${clipId}-left-wing`} clipPathUnits="userSpaceOnUse">
              <path d="M 131 147 C 118 132 108 116 97 99 C 77 70 61 37 48 8 C 41 -2 32 0 25 8 C 12 26 4 53 2 78 C 2 103 8 130 18 153 C 29 174 57 183 80 180 C 101 177 121 165 143 153 Z" />
            </clipPath>
            <clipPath id={`${clipId}-right-wing`} clipPathUnits="userSpaceOnUse">
              <path d="M 213 144 C 238 132 268 117 296 102 C 328 85 352 73 373 65 C 382 62 382 70 379 80 C 371 108 354 137 333 159 C 313 181 288 197 265 200 C 246 200 229 183 212 165 Z" />
            </clipPath>
            <clipPath id={`${clipId}-body`} clipPathUnits="userSpaceOnUse">
              <path d="M 128 151 C 136 136 149 119 164 112 C 170 107 176 107 181 114 C 187 119 191 117 197 122 C 204 128 207 135 215 140 C 227 148 235 163 234 178 C 233 193 228 209 224 223 C 221 234 222 242 231 250 C 221 260 214 280 211 299 C 183 307 140 305 116 297 C 90 290 54 278 35 263 C 24 254 23 240 29 230 C 36 219 49 217 70 215 C 92 213 111 217 128 223 C 121 210 116 198 116 185 C 115 173 119 162 128 151 Z" />
            </clipPath>
          </defs>
          <g className="dove-loading-wing dove-loading-wing--left">
            <image href="/images/loading-dove.png" x="0" y="0" width="382" height="307" clipPath={`url(#${clipId}-left-wing)`} />
          </g>
          <g className="dove-loading-wing dove-loading-wing--right">
            <image href="/images/loading-dove.png" x="0" y="0" width="382" height="307" clipPath={`url(#${clipId}-right-wing)`} />
          </g>
          <image className="dove-loading-bird" href="/images/loading-dove.png" x="0" y="0" width="382" height="307" clipPath={`url(#${clipId}-body)`} />
        </svg>
      </svg>
      <Message className={heading ? 'dove-loading-message dove-loading-message--heading' : 'dove-loading-message'}>
        {message}
      </Message>
    </div>
  )
}
