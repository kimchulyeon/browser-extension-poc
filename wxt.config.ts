import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'AlphaKey Password Manager (POC)',
    description: 'AlphaKey 패스워드 매니저 POC',
    permissions: ['tabs', 'storage', 'activeTab', 'notifications'],
    host_permissions: ['<all_urls>'],
  },
})
