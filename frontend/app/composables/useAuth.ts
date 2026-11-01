export const TOKEN_KEY = 'token_multiprint'

export type AuthUser = {
  id: string
  user_id: string
  name: string
  email?: string | null
  role: string
  active: boolean
}

type AuthResponse = { data: { token: string, pengguna: AuthUser } }
type ProfileResponse = { data: AuthUser }

export function useAuth() {
  const { request, message } = useServiceApi()
  const user = useState<AuthUser | null>('auth:user', () => null)
  const loading = useState('auth:loading', () => false)
  const errorMessage = useState('auth:error', () => '')
  const hasToken = computed(() => import.meta.client && Boolean(localStorage.getItem(TOKEN_KEY)))
  const isAuthenticated = computed(() => Boolean(user.value) && hasToken.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token)
  }
  function clearSession() {
    if (import.meta.client) localStorage.removeItem(TOKEN_KEY)
    user.value = null
  }

  async function login(username: string, password: string) {
    loading.value = true
    errorMessage.value = ''
    try {
      const response = await request<AuthResponse>('/auth/masuk', { method: 'POST', body: { username, kata_sandi: password } })
      saveToken(response.data.token)
      user.value = response.data.pengguna
      return response.data.pengguna
    } catch (error) {
      errorMessage.value = message(error, 'Tidak dapat masuk. Periksa username dan kata sandi.')
      throw error
    } finally { loading.value = false }
  }

  async function loadProfile() {
    if (!hasToken.value) return false
    try {
      const response = await request<ProfileResponse>('/auth/saya')
      user.value = response.data
      return true
    } catch {
      clearSession()
      return false
    }
  }

  function logout() {
    clearSession()
    return navigateTo('/login')
  }

  return { user, loading, errorMessage, hasToken, isAuthenticated, isAdmin, login, loadProfile, logout, clearSession }
}
