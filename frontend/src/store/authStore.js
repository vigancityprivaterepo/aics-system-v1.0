import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      hasHydrated: false,

      setHydrated: (value) => {
        set({ hasHydrated: value })
      },

      initAuth: async () => {
        const { token } = get()
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          try {
            const { data } = await api.get('/users/me')
            set({ user: data })
          } catch (err) {
            if (err.response?.status === 401) {
              delete api.defaults.headers.common['Authorization']
              set({ user: null, token: null })
            }
          }
        } else {
          delete api.defaults.headers.common['Authorization']
        }
      },

      login: async (identifier, password) => {
        set({ isLoading: true })
        try {
          const res = await api.post('/auth/login', { identifier, password })
          const { token, user } = res.data
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          set({ user, token, isLoading: false })
          return { success: true, user }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, message: err.response?.data?.message || 'Login failed' }
        }
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization']
        set({ user: null, token: null })
      },

      updateUser: (updates) => {
        const current = get().user
        if (!current) return
        set({ user: { ...current, ...updates } })
      },
    }),
    {
      name: 'aics-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.initAuth?.()
        state?.setHydrated?.(true)
      },
    }
  )
)
