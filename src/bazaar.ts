import { BazaarApp, type BazaarOptions, type NotificationsAPI } from '@bzr/bazaar'

const config: BazaarOptions = {
  appId: import.meta.env.VITE_APP_ID || 'test',
  // Must match a redirect URI registered for the app, with no trailing slash
  loginRedirectUri: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ''),
  onApiConnectError: async function (bzr: BazaarApp, message: string) {
    console.log('OnConnectError', message)
    bzr.logOut()
  },
  onLoginError: async function (bzr: BazaarApp, message: string) {
    console.log('OnLoginError:', message)
  },
}

if (import.meta.env.VITE_BAZAAR_URI) {
  config.bazaarUri = import.meta.env.VITE_BAZAAR_URI
} else if (import.meta.env.DEV) {
  config.bazaarUri = 'http://localhost:3377'
}

export const bzr = new BazaarApp(config)

/** Private in the SDK since 1.11.0 (bzr-sys/bazaar#72) and untyped there, still served */
export const bzrNotifications: NotificationsAPI = bzr['notifications']
