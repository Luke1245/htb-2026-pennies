import { useCallback, useEffect, useState } from 'react'
import { guides } from './guides.js'

const GUIDE_HASH_PREFIX = '#guide/'

function getGuideIdFromHash(hash) {
  if (!hash.startsWith(GUIDE_HASH_PREFIX)) return null
  const id = hash.slice(GUIDE_HASH_PREFIX.length)
  return id || null
}

function getGuideFromHash(hash) {
  const id = getGuideIdFromHash(hash)
  return id ? guides.find((guide) => guide.id === id) || null : null
}

function guideUrl(id) {
  return `${window.location.pathname}${window.location.search}${GUIDE_HASH_PREFIX}${id}`
}

// Syncs the selected Guide with the URL hash so Guides behave like separate
// pages: browser Back returns to the dashboard instead of leaving the app or
// re-triggering the Auth0 redirect callback.
export function useGuideRoute() {
  const [selectedGuide, setSelectedGuide] = useState(() =>
    getGuideFromHash(window.location.hash),
  )

  useEffect(() => {
    // Direct entry (shared link or refresh): put a dashboard entry beneath the
    // guide so browser Back stays inside the app. StrictMode re-runs this
    // effect; the state check keeps it idempotent.
    const id = getGuideIdFromHash(window.location.hash)
    if (id && !window.history.state?.guideId) {
      const base = window.location.pathname + window.location.search
      window.history.replaceState(null, '', base)
      window.history.pushState({ guideId: id }, '', guideUrl(id))
    }

    const syncFromUrl = () =>
      setSelectedGuide(getGuideFromHash(window.location.hash))
    window.addEventListener('popstate', syncFromUrl)
    window.addEventListener('hashchange', syncFromUrl)
    return () => {
      window.removeEventListener('popstate', syncFromUrl)
      window.removeEventListener('hashchange', syncFromUrl)
    }
  }, [])

  const openGuide = useCallback((guide) => {
    window.history.pushState({ guideId: guide.id }, '', guideUrl(guide.id))
    setSelectedGuide(guide)
  }, [])

  const closeGuide = useCallback(() => {
    if (window.history.state?.guideId) {
      // This entry was pushed on top of a dashboard entry; step back to it
      window.history.back()
    } else {
      // No in-app entry beneath (hash set externally); clear it in place
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
      setSelectedGuide(null)
    }
  }, [])

  return { selectedGuide, openGuide, closeGuide }
}
