import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

// Sessions persist until the user explicitly signs out — a 401 no longer
// force-clears the stored session or redirects; it's left to the caller.
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
)

export default api
