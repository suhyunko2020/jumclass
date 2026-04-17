import { useCallback } from 'react'
import type { Instructor } from '../data/types'
import { saveInstructorRemote, deleteInstructorRemote } from '../utils/storage'

const STORAGE_KEY = 'arcana_instructors'
const ORDER_KEY = 'arcana_instructor_order'

function getCached(): Instructor[] {
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v) : [] }
  catch { return [] }
}

function getCachedOrder(): string[] {
  try { const v = localStorage.getItem(ORDER_KEY); return v ? JSON.parse(v) : [] }
  catch { return [] }
}

function applyOrder(list: Instructor[]): Instructor[] {
  const order = getCachedOrder()
  if (order.length === 0) return list
  return [...list].sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

export function useInstructors() {
  const getAll = useCallback((): Instructor[] => applyOrder(getCached()), [])

  const getPublicInstructors = useCallback((): Instructor[] => {
    return applyOrder(getCached().filter(i => i.status !== 'private'))
  }, [])

  const getInstructor = useCallback((id: string): Instructor | null => {
    return getCached().find(i => i.id === id) || null
  }, [])

  const saveInstructor = useCallback((inst: Instructor) => {
    const all = getCached()
    const idx = all.findIndex(i => i.id === inst.id)
    if (idx >= 0) all[idx] = inst
    else all.push(inst)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    saveInstructorRemote(inst)
  }, [])

  const deleteInstructor = useCallback((id: string) => {
    const all = getCached().filter(i => i.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    deleteInstructorRemote(id)
  }, [])

  const saveInstructorOrder = useCallback((ids: string[]) => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
  }, [])

  return { getAll, getPublicInstructors, getInstructor, saveInstructor, deleteInstructor, saveInstructorOrder }
}
