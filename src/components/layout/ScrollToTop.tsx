import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 페이지 전환 시 스크롤을 최상단으로 이동
// 단, URL에 hash(#anchor)가 있으면 앵커 동작을 보존하기 위해 건너뜀
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash])

  return null
}
