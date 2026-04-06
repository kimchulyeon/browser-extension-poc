import type { FormFieldMeta } from './storage'

// 현재 페이지에서 로그인 관련 폼 요소를 자동 탐지
export function detectLoginFormFields(): FormFieldMeta[] {
  const fields: FormFieldMeta[] = []
  const added = new Set<HTMLElement>()

  // password 인풋 찾기
  const passwordInputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]')
  for (const pw of passwordInputs) {
    if (__isVisible(pw) && !added.has(pw)) {
      fields.push(__buildFieldMeta(pw, 'password'))
      added.add(pw)
    }
  }

  // 아이디 인풋 찾기
  const usernameSelectors = [
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="email"]',
    'input[name*="email" i]',
    'input[name*="user" i]',
    'input[name*="login" i]',
    'input[name*="account" i]',
    'input[id*="email" i]',
    'input[id*="user" i]',
    'input[id*="login" i]',
    'input[id*="id" i]',
    'input[type="text"]',
  ]

  for (const selector of usernameSelectors) {
    const inputs = document.querySelectorAll<HTMLInputElement>(selector)
    for (const un of inputs) {
      if (__isVisible(un) && !added.has(un) && un.type !== 'password' && un.type !== 'hidden') {
        fields.push(__buildFieldMeta(un, 'username'))
        added.add(un)
      }
    }
  }

  // 로그인/제출 버튼 찾기 
  const submitButton = __findLoginButton()
  if (submitButton && !added.has(submitButton)) {
    fields.push(__buildFieldMeta(submitButton, 'submit'))
    added.add(submitButton)
  }

  return fields
}

// 로그인 버튼 찾기
function __findLoginButton(): HTMLElement | null {
  // form 안의 submit 버튼
  const formSubmits = document.querySelectorAll<HTMLElement>(
    'form button[type="submit"], form input[type="submit"]'
  )
  for (const btn of formSubmits) {
    if (__isVisible(btn)) return btn
  }

  // type="submit" 
  const submits = document.querySelectorAll<HTMLElement>(
    'button[type="submit"], input[type="submit"]'
  )
  for (const btn of submits) {
    if (__isVisible(btn)) return btn
  }

  // 로그인 관련 텍스트를 포함하는 버튼
  const loginKeywords = ['로그인', 'log in', 'login', 'sign in', 'signin', '확인', 'submit', '다음', 'next', 'continue', '계속']
  const allButtons = document.querySelectorAll<HTMLElement>('button, a[role="button"], div[role="button"], input[type="button"]')
  for (const btn of allButtons) {
    if (!__isVisible(btn)) continue
    const text = (btn.textContent || btn.getAttribute('value') || btn.getAttribute('aria-label') || '').toLowerCase().trim()
    if (loginKeywords.some(kw => text.includes(kw))) {
      return btn
    }
  }

  // password 필드 근처의 버튼
  const pwField = document.querySelector<HTMLInputElement>('input[type="password"]')
  if (pwField) {
    const form = pwField.closest('form')
    if (form) {
      const formBtn = form.querySelector<HTMLElement>('button, input[type="submit"]')
      if (formBtn && __isVisible(formBtn)) return formBtn
    }

    // form 없으면 password 필드의 부모 컨테이너에서 가장 가까운 버튼
    let container = pwField.parentElement
    for (let i = 0; i < 5 && container; i++) {
      const btn = container.querySelector<HTMLElement>('button')
      if (btn && __isVisible(btn)) return btn
      container = container.parentElement
    }
  }

  // username 필드 근처의 버튼 
  const emailField = document.querySelector<HTMLInputElement>(
    'input[type="email"], input[autocomplete="username"], input[autocomplete="email"]'
  )
  if (emailField) {
    const form = emailField.closest('form')
    if (form) {
      const formBtn = form.querySelector<HTMLElement>('button, input[type="submit"]')
      if (formBtn && __isVisible(formBtn)) return formBtn
    }

    let container = emailField.parentElement
    for (let i = 0; i < 5 && container; i++) {
      const btn = container.querySelector<HTMLElement>('button')
      if (btn && __isVisible(btn)) return btn
      container = container.parentElement
    }
  }

  return null
}

function __isVisible(el: HTMLElement): boolean {
  if (!el) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function __buildFieldMeta(el: HTMLElement, role: FormFieldMeta['role']): FormFieldMeta {
  const input = el as HTMLInputElement
  return {
    role,
    selector: __buildSelector(el),
    tagName: el.tagName.toLowerCase(),
    type: input.type || '',
    name: input.name || '',
    id: el.id || '',
    placeholder: input.placeholder || '',
    autocomplete: input.autocomplete || '',
    innerText: role === 'submit' ? (el.textContent || input.value || '').trim().slice(0, 50) : '',
  }
}

// 요소의 고유한 CSS 셀렉터를 생성
function __buildSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`

  const tag = el.tagName.toLowerCase()
  const input = el as HTMLInputElement

  if (input.name) return `${tag}[name="${input.name}"]`
  if (input.type && tag === 'input') return `${tag}[type="${input.type}"]`
  if (el.getAttribute('autocomplete')) return `${tag}[autocomplete="${el.getAttribute('autocomplete')}"]`

  const parts: string[] = []
  let current: HTMLElement | null = el
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()
    if (current.id) {
      parts.unshift(`#${current.id}`)
      break
    }
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-of-type(${index})`
      }
    }
    parts.unshift(selector)
    current = current.parentElement
  }
  return parts.join(' > ')
}
