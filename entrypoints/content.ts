import { detectLoginFormFields } from '@/utils/form-detector'
import type { FormFieldMeta } from '@/utils/storage'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    console.log('[PM Content] Content Script 로드됨:', window.location.href)

    let lastUrl = window.location.href
    let isProcessing = false

    // 초기 URL 체크
    __checkCurrentUrl()

    // ‼️‼️‼️‼️ SPA 대응: MutationObserver로 DOM 변경 감시
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        console.log('[PW Manager Content] SPA URL 변경 감지:', lastUrl)
        __checkCurrentUrl()
      }

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        __checkForNewForms()
      }, 300)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // ‼️‼️‼️‼️ SPA 대응: popstate
    window.addEventListener('popstate', () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        __checkCurrentUrl()
      }
    })

    function __checkCurrentUrl() {
      if (isProcessing) return
      isProcessing = true

      browser.runtime.sendMessage(
        { type: 'CHECK_URL', url: window.location.href },
        (response) => {
          isProcessing = false
          if (browser.runtime.lastError) return

          if (response?.matched) {
            console.log('[PW Manager Content] URL 매칭:', response.app.appName)

            __showToast(`🔗 URL 감지: "${response.app.appName}"`, 'info')

            // 폼 탐지
            setTimeout(() => {
              __detectAndReport(response.app.appName, response.app.appId)
            }, 800)

            // ‼️‼️‼️‼️ SPA 대응: 추가 재시도 (DOM이 늦게 렌더링되는 경우)
            setTimeout(() => {
              __detectAndReport(response.app.appName, response.app.appId)
            }, 2000)
          }
        }
      )
    }

    const processedForms = new WeakSet<HTMLElement>()
    let lastReportedKey = ''

    function __checkForNewForms() {
      const passwordInputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]')
      for (const input of passwordInputs) {
        if (!processedForms.has(input)) {
          processedForms.add(input)
          browser.runtime.sendMessage(
            { type: 'CHECK_URL', url: window.location.href },
            (response) => {
              if (browser.runtime.lastError) return
              if (response?.matched) {
                __detectAndReport(response.app.appName, response.app.appId)
              }
            }
          )
        }
      }
    }

    function __detectAndReport(appName: string, appId: string) {
      const fields = detectLoginFormFields()
      if (fields.length === 0) return

      // 중복 방지
      const reportKey = fields.map(f => `${f.role}:${f.selector}`).join('|')
      if (reportKey === lastReportedKey) return
      lastReportedKey = reportKey

      console.log('[PW Manager Content] 폼 필드 감지 결과:', fields)

      // Background에 전달 (메타데이터 저장 트리거)
      browser.runtime.sendMessage({
        type: 'FORM_DETECTED',
        appName,
        appId,
        fields,
        url: window.location.href,
      })

      // UI 하이라이트
      __highlightFields(fields)

      // 토스트 팝업
      __showDetectionToast(appName, fields)
    }

    function __highlightFields(fields: FormFieldMeta[]) {
      const colors: Record<string, string> = {
        username: '#2196F3',
        password: '#F44336',
        submit: '#4CAF50',
      }

      for (const field of fields) {
        try {
          const el = document.querySelector<HTMLElement>(field.selector)
          if (el) {
            el.style.outline = `3px solid ${colors[field.role] || '#999'}`
            el.style.outlineOffset = '2px'
            setTimeout(() => {
              el.style.outline = ''
              el.style.outlineOffset = ''
            }, 4000)
          }
        } catch {
          // TODO SELECTOR 오류
        }
      }
    }

    // --- 토스트 UI ---
    function __showDetectionToast(appName: string, fields: FormFieldMeta[]) {
      const roleLabels: Record<string, { emoji: string, label: string, color: string }> = {
        username: { emoji: '👤', label: '아이디', color: '#2196F3' },
        password: { emoji: '🔑', label: '비밀번호', color: '#F44336' },
        submit: { emoji: '🔘', label: '로그인 버튼', color: '#4CAF50' },
      }

      const fieldLines = fields.map(f => {
        const info = roleLabels[f.role] || { emoji: '❓', label: f.role, color: '#999' }
        const detail = f.role === 'submit'
          ? (f.innerText || f.selector)
          : (f.placeholder || f.name || f.id || f.selector)
        return `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
            <span style="font-size:16px">${info.emoji}</span>
            <span style="color:${info.color};font-weight:600;min-width:80px">${info.label}</span>
            <code style="font-size:11px;color:rgba(255,255,255,0.7);word-break:break-all">${__escapeHtml(detail)}</code>
          </div>
        `
      }).join('')

      const html = `
        <div style="margin-bottom:8px;font-weight:700;font-size:14px">
          🔐 폼 감지 완료 — ${__escapeHtml(appName)}
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:8px">
          ${fields.length}개 필드 감지됨 · 메타데이터 저장 완료
        </div>
        ${fieldLines}
      `

      __showToast(html, 'success', 6000, true)
    }

    function __showToast(content: string, type: 'info' | 'success' | 'error' = 'info', duration = 3000, isHtml = false) {
      // 기존 토스트 제거
      document.querySelectorAll('.ak-pm-toast').forEach(el => el.remove())

      const bgColors = {
        info: 'rgba(33, 33, 33, 0.95)',
        success: 'rgba(27, 94, 32, 0.95)',
        error: 'rgba(183, 28, 28, 0.95)',
      }

      const toast = document.createElement('div')
      toast.className = 'ak-pm-toast'
      Object.assign(toast.style, {
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: '2147483647',
        background: bgColors[type],
        color: '#fff',
        padding: '16px 20px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '13px',
        lineHeight: '1.5',
        maxWidth: '420px',
        minWidth: '280px',
        transition: 'all 0.3s ease',
        transform: 'translateX(120%)',
        backdropFilter: 'blur(10px)',
      })

      if (isHtml) {
        toast.innerHTML = content
      } else {
        toast.textContent = content
      }

      const closeBtn = document.createElement('span')
      closeBtn.textContent = '×'
      Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '8px',
        right: '12px',
        cursor: 'pointer',
        fontSize: '18px',
        opacity: '0.6',
      })
      closeBtn.onclick = () => __removeToast(toast)
      toast.style.position = 'fixed'
      toast.style.paddingRight = '36px'
      toast.appendChild(closeBtn)

      document.body.appendChild(toast)

      requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)'
      })

      setTimeout(() => __removeToast(toast), duration)
    }

    function __removeToast(toast: HTMLElement) {
      toast.style.transform = 'translateX(120%)'
      toast.style.opacity = '0'
      setTimeout(() => toast.remove(), 300)
    }

    function __escapeHtml(text: string): string {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }
  },
})
