import React, { useEffect, useState } from 'react'
import { findMatchingStep } from '@/utils/storage'
import type { RegisteredApp, LoginStep } from '@/utils/storage'

export default function PopupApp() {
  const [currentUrl, setCurrentUrl] = useState('')
  const [matchedApp, setMatchedApp] = useState<RegisteredApp | null>(null)
  const [matchedStep, setMatchedStep] = useState<LoginStep | null>(null)

  useEffect(() => {
    // 현재 탭 URL 가져오기
    browser.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0]?.url || ''
      setCurrentUrl(url)

      const match = await findMatchingStep(url)
      if (match) {
        setMatchedApp(match.app)
        setMatchedStep(match.step)
      }
    })
  }, [])

  const openOptions = () => {
    browser.runtime.openOptionsPage()
  }

  function truncateUrl(url: string, max = 40): string {
    if (url.length <= max) return url
    try {
      const u = new URL(url)
      return u.hostname + u.pathname.slice(0, 15) + '...'
    } catch {
      return url.slice(0, max) + '...'
    }
  }

  return (
    <div className="popup">
      <h1>🔐 AlphaKey PW Manager</h1>

      {matchedApp ? (
        <div className="status matched">
          <strong>{matchedApp.appName}</strong>
          <div style={{ fontSize: 11, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Step {matchedStep?.stepOrder} | {truncateUrl(matchedStep?.urls[0] || '')}
          </div>

          {matchedStep && matchedStep.formFields.length > 0 && (
            <div className="fields" style={{ marginTop: 8 }}>
              {matchedStep.formFields.map((field, i) => (
                <div key={i} className="field">
                  <span className={`dot ${field.role}`} />
                  <span>{field.role}: <code>{field.selector}</code></span>
                </div>
              ))}
            </div>
          )}

          {matchedStep && matchedStep.formFields.length === 0 && (
            <div style={{ fontSize: 11, marginTop: 4, color: '#999' }}>
              폼 메타데이터 미감지 — 페이지를 새로고침 해보세요
            </div>
          )}
        </div>
      ) : (
        <div className="status unmatched">
          등록되지 않은 페이지입니다
          <div style={{ fontSize: 11, marginTop: 4, wordBreak: 'break-all' }}>
            {currentUrl || '(URL 없음)'}
          </div>
        </div>
      )}

      <div className="actions">
        <button className="btn-settings" onClick={openOptions}>
          설정 페이지 열기
        </button>
      </div>
    </div>
  )
}
