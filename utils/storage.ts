import { storage } from 'wxt/utils/storage'

// --- 타입 정의 ---

export interface FormFieldMeta {
  role: 'username' | 'password' | 'submit'
  selector: string
  tagName: string
  type: string
  name: string
  id: string
  placeholder: string
  autocomplete: string
  innerText?: string
}

export interface LoginStep {
  stepOrder: number
  urls: string[]
  formFields: FormFieldMeta[]
  detectedAt?: string
}

export interface RegisteredApp {
  appId: string
  appName: string
  loginSteps: LoginStep[]
  createdAt: string
  updatedAt: string
}

// --- 스토리지 ---

const APPS_KEY = 'local:registeredApps'

export async function getRegisteredApps(): Promise<RegisteredApp[]> {
  const apps = await storage.getItem<RegisteredApp[]>(APPS_KEY)
  return apps || []
}

export async function saveRegisteredApps(apps: RegisteredApp[]): Promise<void> {
  await storage.setItem(APPS_KEY, apps)
}

export async function addApp(app: RegisteredApp): Promise<void> {
  const apps = await getRegisteredApps()
  apps.push(app)
  await saveRegisteredApps(apps)
}

export async function updateApp(appId: string, updater: (app: RegisteredApp) => RegisteredApp): Promise<void> {
  const apps = await getRegisteredApps()
  const idx = apps.findIndex(a => a.appId === appId)
  if (idx !== -1) {
    apps[idx] = updater(apps[idx])
    await saveRegisteredApps(apps)
  }
}

export async function removeApp(appId: string): Promise<void> {
  const apps = await getRegisteredApps()
  await saveRegisteredApps(apps.filter(a => a.appId !== appId))
}

// --- URL 매칭 ---

function normalizeUrl(input: string): string {
  let url = input.trim()
  // 프로토콜이 없으면 https:// 추가
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }
  // 끝 슬래시 제거
  return url.replace(/\/+$/, '')
}

function extractHost(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname
  } catch {
    return url
  }
}

export function matchUrl(pageUrl: string, registeredUrl: string): boolean {
  const normalized = normalizeUrl(registeredUrl)

  // 1. 정규화된 URL로 startsWith 비교
  if (pageUrl.startsWith(normalized)) return true

  // 2. 호스트명만 비교 (경로 없이 도메인만 등록한 경우)
  try {
    const pageHost = new URL(pageUrl).hostname
    const regHost = extractHost(registeredUrl)
    if (pageHost === regHost) return true
  } catch {
    // URL 파싱 실패 시 무시
  }

  return false
}

export async function findMatchingStep(url: string): Promise<{ app: RegisteredApp, step: LoginStep } | null> {
  const apps = await getRegisteredApps()
  for (const app of apps) {
    for (const step of app.loginSteps) {
      for (const registeredUrl of step.urls) {
        if (matchUrl(url, registeredUrl)) {
          return { app, step }
        }
      }
    }
  }
  return null
}
