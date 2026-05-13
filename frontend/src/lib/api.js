import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

// Response interceptor — handle 401 globally (skip the login route itself)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('aics-auth')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
