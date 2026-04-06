import { useEffect, useState } from 'react'
import type { RegisteredApp, LoginStep } from '@/utils/storage'
import { getRegisteredApps, saveRegisteredApps } from '@/utils/storage'

export default function OptionsApp() {
  const [apps, setApps] = useState<RegisteredApp[]>([])
  const [newAppName, setNewAppName] = useState('')

  // 초기 로드
  useEffect(() => {
    getRegisteredApps().then(setApps)
  }, [])

  // 앱 추가
  const handleAddApp = async () => {
    if (!newAppName.trim()) return
    const app: RegisteredApp = {
      appId: `app-${Date.now()}`,
      appName: newAppName.trim(),
      loginSteps: [
        { stepOrder: 1, urls: [], formFields: [] }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = [...apps, app]
    await saveRegisteredApps(updated)
    setApps(updated)
    setNewAppName('')
  }

  // 앱 삭제
  const handleRemoveApp = async (appId: string) => {
    const updated = apps.filter(a => a.appId !== appId)
    await saveRegisteredApps(updated)
    setApps(updated)
  }

  // Step 추가
  const handleAddStep = async (appId: string) => {
    const updated = apps.map(app => {
      if (app.appId !== appId) return app
      return {
        ...app,
        loginSteps: [
          ...app.loginSteps,
          { stepOrder: app.loginSteps.length + 1, urls: [], formFields: [] }
        ],
        updatedAt: new Date().toISOString(),
      }
    })
    await saveRegisteredApps(updated)
    setApps(updated)
  }

  // Step 삭제
  const handleRemoveStep = async (appId: string, stepOrder: number) => {
    const updated = apps.map(app => {
      if (app.appId !== appId) return app
      const steps = app.loginSteps
        .filter(s => s.stepOrder !== stepOrder)
        .map((s, i) => ({ ...s, stepOrder: i + 1 }))
      return { ...app, loginSteps: steps, updatedAt: new Date().toISOString() }
    })
    await saveRegisteredApps(updated)
    setApps(updated)
  }

  // URL 추가
  const handleAddUrl = async (appId: string, stepOrder: number, url: string) => {
    if (!url.trim()) return
    const updated = apps.map(app => {
      if (app.appId !== appId) return app
      return {
        ...app,
        loginSteps: app.loginSteps.map(step => {
          if (step.stepOrder !== stepOrder) return step
          if (step.urls.includes(url.trim())) return step
          return { ...step, urls: [...step.urls, url.trim()] }
        }),
        updatedAt: new Date().toISOString(),
      }
    })
    await saveRegisteredApps(updated)
    setApps(updated)
  }

  // URL 삭제
  const handleRemoveUrl = async (appId: string, stepOrder: number, url: string) => {
    const updated = apps.map(app => {
      if (app.appId !== appId) return app
      return {
        ...app,
        loginSteps: app.loginSteps.map(step => {
          if (step.stepOrder !== stepOrder) return step
          return { ...step, urls: step.urls.filter(u => u !== url) }
        }),
        updatedAt: new Date().toISOString(),
      }
    })
    await saveRegisteredApps(updated)
    setApps(updated)
  }

  // 메타데이터 초기화
  const handleClearMeta = async (appId: string, stepOrder: number) => {
    const updated = apps.map(app => {
      if (app.appId !== appId) return app
      return {
        ...app,
        loginSteps: app.loginSteps.map(step => {
          if (step.stepOrder !== stepOrder) return step
          return { ...step, formFields: [], detectedAt: undefined }
        }),
        updatedAt: new Date().toISOString(),
      }
    })
    await saveRegisteredApps(updated)
    setApps(updated)
  }

  // Content Script에서 감지된 메타데이터 수신
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'FORM_DETECTED') {
        // 감지된 메타데이터를 해당 앱의 step에 저장
        getRegisteredApps().then(currentApps => {
          const updated = currentApps.map(app => {
            if (app.appId !== message.appId) return app
            return {
              ...app,
              loginSteps: app.loginSteps.map(step => {
                // URL이 매칭되는 step 찾기
                const urlMatched = step.urls.some(u => message.url.startsWith(u))
                if (!urlMatched) return step
                return {
                  ...step,
                  formFields: message.fields,
                  detectedAt: new Date().toISOString(),
                }
              }),
              updatedAt: new Date().toISOString(),
            }
          })
          saveRegisteredApps(updated).then(() => setApps(updated))
        })
      }
    }
    browser.runtime.onMessage.addListener(listener)
    return () => browser.runtime.onMessage.removeListener(listener)
  }, [])

  // 주기적 새로고침 (다른 탭에서 감지된 데이터 반영하기 위함)
  useEffect(() => {
    const interval = setInterval(() => {
      getRegisteredApps().then(setApps)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="container">
      <h1>🔐 AlphaKey Password Manager (POC)</h1>

      {/* 앱 추가 */}
      <div className="card">
        <h2>SaaS 앱 추가</h2>
        <div className="form-row">
          <input
            type="text"
            placeholder="앱 이름 (예: Google Workspace, Notion)"
            value={newAppName}
            onChange={e => setNewAppName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddApp()}
          />
          <button className="btn-primary" onClick={handleAddApp}>추가</button>
        </div>
      </div>

      {/* 등록된 앱 목록 */}
      {apps.length === 0 && (
        <div className="card">
          <p className="empty">등록된 앱이 없습니다. 위에서 앱을 추가해주세요.</p>
        </div>
      )}

      {apps.map(app => (
        <AppCard
          key={app.appId}
          app={app}
          onRemoveApp={handleRemoveApp}
          onAddStep={handleAddStep}
          onRemoveStep={handleRemoveStep}
          onAddUrl={handleAddUrl}
          onRemoveUrl={handleRemoveUrl}
          onClearMeta={handleClearMeta}
        />
      ))}
    </div>
  )
}

// --- 앱 카드 ---
function AppCard({ app, onRemoveApp, onAddStep, onRemoveStep, onAddUrl, onRemoveUrl, onClearMeta }: {
  app: RegisteredApp
  onRemoveApp: (appId: string) => void
  onAddStep: (appId: string) => void
  onRemoveStep: (appId: string, stepOrder: number) => void
  onAddUrl: (appId: string, stepOrder: number, url: string) => void
  onRemoveUrl: (appId: string, stepOrder: number, url: string) => void
  onClearMeta: (appId: string, stepOrder: number) => void
}) {
  return (
    <div className="card">
      <div className="app-header">
        <h2>{app.appName}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary btn-small" onClick={() => onAddStep(app.appId)}>
            + 로그인 단계 추가
          </button>
          <button className="btn-danger btn-small" onClick={() => onRemoveApp(app.appId)}>
            앱 삭제
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        생성: {new Date(app.createdAt).toLocaleString()} | 수정: {new Date(app.updatedAt).toLocaleString()}
      </p>

      {app.loginSteps.map(step => (
        <StepCard
          key={step.stepOrder}
          appId={app.appId}
          step={step}
          totalSteps={app.loginSteps.length}
          onRemoveStep={onRemoveStep}
          onAddUrl={onAddUrl}
          onRemoveUrl={onRemoveUrl}
          onClearMeta={onClearMeta}
        />
      ))}
    </div>
  )
}

// --- 스텝 카드 ---
function StepCard({ appId, step, totalSteps, onRemoveStep, onAddUrl, onRemoveUrl, onClearMeta }: {
  appId: string
  step: LoginStep
  totalSteps: number
  onRemoveStep: (appId: string, stepOrder: number) => void
  onAddUrl: (appId: string, stepOrder: number, url: string) => void
  onRemoveUrl: (appId: string, stepOrder: number, url: string) => void
  onClearMeta: (appId: string, stepOrder: number) => void
}) {
  const [urlInput, setUrlInput] = useState('')

  const handleAddUrl = () => {
    if (!urlInput.trim()) return
    onAddUrl(appId, step.stepOrder, urlInput)
    setUrlInput('')
  }

  const stepLabel = totalSteps > 1
    ? `Step ${step.stepOrder}: ${step.stepOrder === 1 ? '아이디 입력' : '비밀번호 입력'}`
    : `Step ${step.stepOrder}: 로그인`

  return (
    <div className="step-card">
      <div className="step-header">
        <h3>{stepLabel}</h3>
        {totalSteps > 1 && (
          <button className="btn-danger btn-small" onClick={() => onRemoveStep(appId, step.stepOrder)}>
            단계 삭제
          </button>
        )}
      </div>

      {/* URL 입력 */}
      <div className="form-row">
        <input
          type="text"
          placeholder="로그인 URL (예: https://accounts.google.com/identifier)"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
        />
        <button className="btn-primary btn-small" onClick={handleAddUrl}>URL 추가</button>
      </div>

      {/* 등록된 URL 목록 */}
      <div style={{ marginBottom: 12 }}>
        {step.urls.length === 0 && <span className="empty">등록된 URL이 없습니다</span>}
        {step.urls.map(url => (
          <span key={url} className="url-tag">
            {url}
            <span className="remove" onClick={() => onRemoveUrl(appId, step.stepOrder, url)}>×</span>
          </span>
        ))}
      </div>

      <div className="divider" />

      {/* 감지된 폼 메타데이터 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3>📋 폼 메타데이터 {step.detectedAt && <span style={{ fontWeight: 'normal', color: '#999' }}>(감지: {new Date(step.detectedAt).toLocaleString()})</span>}</h3>
        {step.formFields.length > 0 && (
          <button className="btn-secondary btn-small" onClick={() => onClearMeta(appId, step.stepOrder)}>초기화</button>
        )}
      </div>

      {step.formFields.length === 0 ? (
        <p className="empty">등록된 URL을 방문하면 자동으로 폼 요소가 감지됩니다.</p>
      ) : (
        <div className="meta-list">
          {step.formFields.map((field, idx) => (
            <div key={idx} className="meta-item">
              <div className="meta-item-role">
                <span className={`role-badge ${field.role}`}>
                  {field.role === 'username' ? '아이디' : field.role === 'password' ? '비밀번호' : '로그인 버튼'}
                </span>
              </div>
              <div className="meta-item-details">
                <div className="detail">
                  <span className="detail-label">셀렉터</span>
                  <span className="detail-value">{field.selector}</span>
                </div>
                <div className="detail">
                  <span className="detail-label">태그</span>
                  <span className="detail-value">{field.tagName}</span>
                </div>
                {field.type && (
                  <div className="detail">
                    <span className="detail-label">type</span>
                    <span className="detail-value">{field.type}</span>
                  </div>
                )}
                {field.name && (
                  <div className="detail">
                    <span className="detail-label">name</span>
                    <span className="detail-value">{field.name}</span>
                  </div>
                )}
                {field.id && (
                  <div className="detail">
                    <span className="detail-label">id</span>
                    <span className="detail-value">{field.id}</span>
                  </div>
                )}
                {field.placeholder && (
                  <div className="detail">
                    <span className="detail-label">placeholder</span>
                    <span className="detail-value">{field.placeholder}</span>
                  </div>
                )}
                {field.innerText && (
                  <div className="detail">
                    <span className="detail-label">텍스트</span>
                    <span className="detail-value">{field.innerText}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
