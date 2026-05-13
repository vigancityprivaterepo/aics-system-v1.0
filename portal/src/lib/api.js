import axios from 'axios'
import { dispatchSessionExpired, PORTAL_AUTH_STORAGE_KEY } from './session'

const api = axios.create({ baseURL: import.meta.env.VITE_PORTAL_API_URL || '/api/portal' })

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem(PORTAL_AUTH_STORAGE_KEY)
  if (raw) {
    try {
      const { state } = JSON.parse(raw)
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`
    } catch { /* ignore */ }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(PORTAL_AUTH_STORAGE_KEY)
      dispatchSessionExpired()
    }
    return Promise.reject(err)
  }
)

export default api
