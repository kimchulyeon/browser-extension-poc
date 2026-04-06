import { findMatchingStep, getRegisteredApps, saveRegisteredApps, matchUrl } from '@/utils/storage'

export default defineBackground(() => {
  console.log('[PW Manager Background] Service Worker 시작 >>>>>>>>>>>')

  // 탭 URL 변경 감지
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab.url) return

    if (changeInfo.url || changeInfo.status === 'complete') {
      const url = changeInfo.url || tab.url
      const match = await findMatchingStep(url)

      if (match) {
        console.log(`[PW Manager Background] URL 매칭: ${match.app.appName} (Step ${match.step.stepOrder})`)

        browser.tabs.sendMessage(tabId, {
          type: 'URL_MATCHED',
          appId: match.app.appId,
          appName: match.app.appName,
          step: match.step,
        }).catch(() => {})

        browser.action.setBadgeText({ text: '✓', tabId })
        browser.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId })
      } else {
        browser.action.setBadgeText({ text: '', tabId })
      }
    }
  })

  // 메시지 수신
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_URL') {
      findMatchingStep(message.url).then(match => {
        sendResponse({ matched: !!match, app: match?.app, step: match?.step })
      })
      return true
    }

    if (message.type === 'FORM_DETECTED') {
      console.log(`[PW Manager Background] 폼 감지:`, message.fields)

      // 메타데이터를 해당 앱의 step에 자동 저장
      saveFormMetadata(message.appId, message.url, message.fields).then(() => {
        console.log(`[PW Manager Background] 메타데이터 저장 완료: ${message.appName}`)
      })

      sendResponse({ ok: true })
    }

    if (message.type === 'URL_DETECTED') {
      console.log(`[PW Manager Background] URL 감지:`, message.appName)
      sendResponse({ ok: true })
    }
  })
})

// 감지된 폼 메타데이터를 해당 앱의 매칭되는 step에 저장
async function saveFormMetadata(appId: string, pageUrl: string, fields: any[]) {
  const apps = await getRegisteredApps()
  let updated = false

  const newApps = apps.map(app => {
    if (app.appId !== appId) return app

    const newSteps = app.loginSteps.map(step => {
      const urlMatched = step.urls.some(u => matchUrl(pageUrl, u))
      if (!urlMatched) return step

      updated = true
      return {
        ...step,
        formFields: fields,
        detectedAt: new Date().toISOString(),
      }
    })

    return {
      ...app,
      loginSteps: newSteps,
      updatedAt: new Date().toISOString(),
    }
  })

  if (updated) {
    await saveRegisteredApps(newApps)
  }
}
