import { useEffect, useState } from 'react'

// True on phone-width screens. Used to shrink the frozen label column on the
// timeline / Gantt so the chart itself gets usable room on mobile.
export function useIsMobile(query = '(max-width: 640px)') {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false)
  const [mobile, setMobile] = useState(get)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    setMobile(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return mobile
}
