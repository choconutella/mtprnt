type ApiOptions = Parameters<typeof $fetch>[1]

export function useServiceApi() {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiBaseUrl || 'http://localhost:5000/api'

  async function request<T>(path: string, options: ApiOptions = {}) {
    const headers = new Headers(options.headers as HeadersInit | undefined)

    if (import.meta.client) {
      const token = localStorage.getItem('token_multiprint')
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }

    try {
      return await $fetch<T>(`${baseUrl}${path}`, { ...options, headers })
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 401 && import.meta.client) {
        localStorage.removeItem('token_multiprint')
        if (window.location.pathname !== '/login') {
          await navigateTo({ path: '/login', query: { redirect: window.location.pathname } })
        }
      }
      throw error
    }
  }

  function message(error: unknown, fallback: string) {
    const response = error as { data?: { pesan?: string }, statusMessage?: string }
    return response.data?.pesan || response.statusMessage || fallback
  }

  return { request, message }
}
