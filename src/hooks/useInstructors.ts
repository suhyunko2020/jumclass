import { useCallback } from 'react'
import type { Instructor } from '../data/types'

const STORAGE_KEY = 'arcana_instructors'

function getCached(): Instructor[] {
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v) : [] }
  catch { return [] }
}

export function useInstructors() {
  const getAll = useCallback((): Instructor[] => getCached(), [])

  const getPublicInstructors = useCallback((): Instructor[] => {
    return getCached().filter(i => i.status !== 'private')
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
  }, [])

  const deleteInstructor = useCallback((id: string) => {
    const all = getCached().filter(i => i.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  }, [])

  return { getAll, getPublicInstructors, getInstructor, saveInstructor, deleteInstructor }
}
