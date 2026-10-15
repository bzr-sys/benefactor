import { BazaarApp, type BazaarOptions } from '@bzr/bazaar'

const config: BazaarOptions = {
  appId: import.meta.env.VITE_APP_ID || 'test',
  loginRedirectUri: window.location.origin,
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
