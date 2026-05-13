import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PORTAL_AUTH_STORAGE_KEY, resetSessionExpiryDispatch } from '../lib/session'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      applicant: null,
      setAuth: (token, applicant) => {
        resetSessionExpiryDispatch()
        set({ token, applicant })
      },
      updateApplicant: (updates) =>
        set((state) => ({ applicant: state.applicant ? { ...state.applicant, ...updates } : null })),
      logout: () => set({ token: null, applicant: null }),
    }),
    { name: PORTAL_AUTH_STORAGE_KEY }
  )
)
