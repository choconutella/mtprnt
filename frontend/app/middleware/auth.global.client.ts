export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()

  if (to.path === '/login') {
    if (auth.hasToken.value) {
      const valid = auth.user.value ? true : await auth.loadProfile()
      if (valid) return navigateTo(typeof to.query.redirect === 'string' ? to.query.redirect : '/')
    }
    return
  }

  if (!auth.hasToken.value) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  if (!auth.user.value && !(await auth.loadProfile())) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
})
