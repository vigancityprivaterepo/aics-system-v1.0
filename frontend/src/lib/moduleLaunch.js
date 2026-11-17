// Momentum transition for dashboard cards that open another page.
//
// Click: the card presses, then pops toward the viewer while the rest of the
// dashboard fades away; the destination page grows in from the card's spot.
// Browser Back plays the same motion in reverse on the dashboard.
// Only transform and opacity animate. Reduced motion falls back to a fade.
//
// Top-bar module tabs and case rows use launchFromNav: the tab presses, the current page
// recedes, and the new page grows in from under the tab; Back zooms back in.
//
// Markup contract (see index.css, "Module launch"):
//   root  data-launch-root   the page that owns the cards
//   card  data-launch-card   a clickable card; its value is a stable id
//   fade  data-launch-fade   a non-card block that should fade with the rest
//   tab   data-launch-tab    a top-bar module link
//   row   data-launch-row    a case row/link that opens a case
//   page  data-launch-page   the layout box around <Outlet /> (one per app)

import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const STORAGE_KEY = 'aics.moduleLaunch'
const LAUNCH_MS = 340
const REDUCED_MS = 150
const NAV_LEAVE_MS = 200
// Longest enter/return animation (420ms) plus margin.
const CLEANUP_MS = 520
// A stored launch older than this is stale (tab left open), so Back won't replay it.
const RETURN_WINDOW_MS = 30 * 60 * 1000

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function readLaunch() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

function writeLaunch(value) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked (private mode): the transition still plays, Back just won't reverse.
  }
}

// onClick handler for a card <Link>. Leaves modified clicks (new tab, etc.) to the browser.
export function launchModule(event, navigate, to) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const card = event.currentTarget
  const root = card.closest('[data-launch-root]')
  if (!root) return
  event.preventDefault()
  if (root.classList.contains('is-launching')) return

  const rect = card.getBoundingClientRect()
  writeLaunch({
    id: card.getAttribute('data-launch-card'),
    to,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    at: Date.now(),
  })

  card.classList.add('is-launching')
  root.classList.add('is-launching')
  window.setTimeout(() => navigate(to), prefersReducedMotion() ? REDUCED_MS : LAUNCH_MS)
}

// onClick handler for a top-bar module link (tab or dropdown item), or, with
// origin 'center', for a case row that opens the case.
export function openCase(event, navigate, caseId) {
  launchFromNav(event, navigate, `/cases/${caseId}`, { origin: 'center' })
}

export function launchFromNav(event, navigate, to, { origin = 'below' } = {}) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const page = document.querySelector('[data-launch-page]')
  if (!page) return
  event.preventDefault()
  // Already on this page: nothing to animate or navigate.
  if (`${window.location.pathname}${window.location.search}` === to) return
  if (page.classList.contains('is-leaving')) return

  const rect = event.currentTarget.getBoundingClientRect()
  const y = origin === 'center' ? rect.top + rect.height / 2 : rect.bottom
  writeLaunch({ kind: 'tab', to, x: rect.left + rect.width / 2, y, at: Date.now() })
  page.classList.add('is-leaving')
  window.setTimeout(() => navigate(to), prefersReducedMotion() ? REDUCED_MS : NAV_LEAVE_MS)
  // Safety net: never leave the page hidden if the navigation is redirected.
  window.setTimeout(() => page.classList.remove('is-leaving'), 1000)
}

function playOnce(el, className) {
  el.classList.remove(className)
  // Force a reflow so re-adding the class restarts the animation.
  void el.offsetWidth
  el.classList.add(className)
  // Timer, not animationend: a root's animation runs on its children, and a
  // lingering transform would break position: fixed modals inside the page.
  window.setTimeout(() => {
    el.classList.remove(className)
    el.style.removeProperty('transform-origin')
  }, CLEANUP_MS)
}

// Destination side: call in the layout around <Outlet />. When the page just
// opened came from a card launch, it grows in from that card's position.
export function useModuleEnter(containerRef) {
  const location = useLocation()
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.classList.remove('is-leaving')
    const launch = readLaunch()
    if (!launch) return
    // Back after a tab launch: the previous page zooms back into place.
    if (launch.kind === 'tab' && launch.entered && navigationType === 'POP') {
      writeLaunch(null)
      if (Date.now() - launch.at <= RETURN_WINDOW_MS) playOnce(el, 'module-back')
      return
    }
    if (launch.entered) return
    if (`${location.pathname}${location.search}` !== launch.to) return
    writeLaunch({ ...launch, entered: true })
    const box = el.getBoundingClientRect()
    el.style.transformOrigin = `${Math.round(launch.x - box.left)}px ${Math.round(launch.y - box.top)}px`
    playOnce(el, 'module-enter')
  }, [containerRef, location.pathname, location.search, navigationType])
}

// Origin side: call on the page that owns the cards. On browser Back to it,
// the launched card settles back into place and the rest fades back in.
export function useModuleReturn(rootRef, ready = true) {
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    if (!ready) return
    const root = rootRef.current
    const launch = readLaunch()
    // Tab launches are reversed by useModuleEnter, not here.
    if (!root || !launch || launch.kind === 'tab') return
    writeLaunch(null)
    if (navigationType !== 'POP' || !launch.entered || Date.now() - launch.at > RETURN_WINDOW_MS) return
    const card = root.querySelector(`[data-launch-card="${CSS.escape(launch.id ?? '')}"]`)
    if (card) playOnce(card, 'is-returning')
    playOnce(root, 'is-returning')
  }, [rootRef, navigationType, ready])
}
