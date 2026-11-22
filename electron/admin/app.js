const PLAN_LABELS = {
  starter: 'Starter',
  standard: 'Standard',
  advanced: 'Advanced',
}

const state = {
  token: '',
  licenses: [],
  search: '',
  plan: 'all',
  source: 'all',
  busy: false,
}

const els = {
  loginView: document.getElementById('login-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  tokenInput: document.getElementById('admin-token'),
  rememberToken: document.getElementById('remember-token'),
  toggleToken: document.getElementById('toggle-token'),
  loginError: document.getElementById('login-error'),
  connectButton: document.getElementById('connect-button'),
  syncLabel: document.getElementById('sync-label'),
  lockButton: document.getElementById('lock-button'),
  refreshTop: document.getElementById('refresh-top'),
  refreshButton: document.getElementById('refresh-button'),
  retryButton: document.getElementById('retry-button'),
  searchInput: document.getElementById('search-input'),
  planFilter: document.getElementById('plan-filter'),
  sourceFilter: document.getElementById('source-filter'),
  loading: document.getElementById('loading-state'),
  errorBox: document.getElementById('error-state'),
  errorMessage: document.getElementById('error-message'),
  empty: document.getElementById('empty-state'),
  tableWrap: document.getElementById('table-wrap'),
  licenseBody: document.getElementById('license-body'),
  resultCount: document.getElementById('result-count'),
  statTotal: document.getElementById('stat-total'),
  statCompanies: document.getElementById('stat-companies'),
  statStripe: document.getElementById('stat-stripe'),
  statManual: document.getElementById('stat-manual'),
  statMix: document.getElementById('stat-mix'),
  issueButton: document.getElementById('issue-button'),
  emptyIssueButton: document.getElementById('empty-issue-button'),
  exportButton: document.getElementById('export-button'),
  issueDialog: document.getElementById('issue-dialog'),
  issueForm: document.getElementById('issue-form'),
  issuePlan: document.getElementById('issue-plan'),
  issueCompany: document.getElementById('issue-company'),
  issueEmail: document.getElementById('issue-email'),
  issueError: document.getElementById('issue-error'),
  issueSubmit: document.getElementById('issue-submit'),
  detailDialog: document.getElementById('detail-dialog'),
  detailCompany: document.getElementById('detail-company'),
  detailBody: document.getElementById('detail-body'),
  toast: document.getElementById('toast'),
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function decodeLicenseKey(key) {
  if (typeof key !== 'string' || !key.startsWith('TAP-')) return null
  const rest = key.slice(4)
  const separator = rest.lastIndexOf('.')
  if (separator <= 0) return null
  try {
    const normalized = rest
      .slice(0, separator)
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function normalizeLicense(raw) {
  const payload = decodeLicenseKey(raw.licenseKey) ?? {}
  return {
    ...raw,
    company: raw.company || payload.company || 'Unknown company',
    plan: PLAN_LABELS[raw.plan] ? raw.plan : payload.plan ?? 'starter',
    issuedAt: raw.createdAt || payload.issuedAt || '',
    updatesUntil: payload.updatesUntil || '',
    licenseId: payload.licenseId || '',
    payload,
  }
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function updatesActive(license) {
  const time = new Date(license.updatesUntil).getTime()
  return Number.isFinite(time) && time > Date.now()
}

function maskKey(key) {
  if (!key) return '-'
  if (key.length <= 26) return key
  return `${key.slice(0, 14)}...${key.slice(-8)}`
}

let toastTimer = null
function toast(message) {
  els.toast.textContent = message
  els.toast.hidden = false
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    els.toast.hidden = true
  }, 2400)
}

async function copyText(text, label = 'Copied to clipboard.') {
  try {
    await window.licenseConsole.copyText(text)
    toast(label)
  } catch {
    toast('Could not copy to the clipboard.')
  }
}

function showLoginError(message) {
  els.loginError.textContent = message
  els.loginError.hidden = !message
}

function setLoginBusy(busy) {
  els.connectButton.disabled = busy
  els.connectButton.textContent = busy
    ? 'Connecting...'
    : 'Connect to license service'
}

async function connect(token, { remember = true, auto = false } = {}) {
  if (!token) {
    showLoginError('Enter the admin token.')
    return
  }

  setLoginBusy(true)
  showLoginError('')
  els.syncLabel.textContent = 'Connecting'
  els.connectButton.textContent = 'Connecting...'

  const result = await window.licenseConsole.api({
    method: 'GET',
    path: '/api/trucktap/admin/licenses',
    token,
  })

  setLoginBusy(false)

  if (!result.ok) {
    const message =
      result.status === 401
        ? 'That admin token was rejected. Check LICENSE_ADMIN_TOKEN on the Worker.'
        : result.error ||
          result.data?.error ||
          'Could not connect to the license service.'
    els.syncLabel.textContent = 'Offline'
    if (auto) {
      els.tokenInput.value = token
      showLoginError(message)
      return
    }
    showLoginError(message)
    return
  }

  state.token = token
  if (remember) {
    const saved = await window.licenseConsole.saveToken(token)
    if (!saved) showLoginError('Connected, but the token could not be saved.')
  } else {
    await window.licenseConsole.clearToken()
  }

  state.licenses = (result.data?.licenses ?? []).map(normalizeLicense)
  els.loginView.hidden = true
  els.appView.hidden = false
  els.syncLabel.textContent = 'Connected'
  renderAll()
}

function lock() {
  state.token = ''
  state.licenses = []
  els.appView.hidden = true
  els.loginView.hidden = false
  els.tokenInput.value = ''
  els.syncLabel.textContent = 'Locked'
  showLoginError('')
}

async function refresh() {
  if (!state.token || state.busy) return
  state.busy = true
  els.syncLabel.textContent = 'Refreshing'
  els.errorBox.hidden = true
  const result = await window.licenseConsole.api({
    method: 'GET',
    path: '/api/trucktap/admin/licenses',
    token: state.token,
  })
  state.busy = false

  if (!result.ok) {
    if (result.status === 401) {
      lock()
      showLoginError('Your admin session expired. Connect again.')
      return
    }
    els.errorMessage.textContent =
      result.error || result.data?.error || 'Could not load licenses.'
    els.errorBox.hidden = false
    els.syncLabel.textContent = 'Error'
    return
  }

  state.licenses = (result.data?.licenses ?? []).map(normalizeLicense)
  els.syncLabel.textContent = 'Connected'
  renderAll()
}

function filteredLicenses() {
  const term = state.search.trim().toLowerCase()
  return state.licenses.filter((license) => {
    if (state.plan !== 'all' && license.plan !== state.plan) return false
    if (state.source !== 'all' && license.source !== state.source) return false
    if (!term) return true
    return [
      license.company,
      license.email,
      license.sessionId,
      license.licenseId,
      license.licenseKey,
      license.plan,
    ]
      .join(' ')
      .toLowerCase()
      .includes(term)
  })
}

function renderStats() {
  const licenses = state.licenses
  const companies = new Set(
    licenses.map((license) => license.company.toLowerCase()),
  )
  const counts = { starter: 0, standard: 0, advanced: 0 }
  for (const license of licenses) {
    if (counts[license.plan] !== undefined) counts[license.plan] += 1
  }

  els.statTotal.textContent = String(licenses.length)
  els.statCompanies.textContent = String(companies.size)
  els.statStripe.textContent = String(
    licenses.filter((license) => license.source === 'stripe').length,
  )
  els.statManual.textContent = String(
    licenses.filter((license) => license.source === 'manual').length,
  )
  els.statMix.textContent = `${counts.starter} / ${counts.standard} / ${counts.advanced}`
}

function badge(text, className) {
  return el('span', `badge ${className}`, text)
}

function buildRow(license) {
  const row = document.createElement('tr')

  const companyCell = el('td')
  companyCell.append(el('span', 'company-name', license.company))
  companyCell.append(
    el(
      'span',
      'company-meta',
      license.sessionId.startsWith('manual_')
        ? 'Manual license'
        : license.sessionId.slice(0, 22),
    ),
  )

  const planCell = el('td')
  planCell.append(badge(PLAN_LABELS[license.plan] ?? license.plan, `plan-${license.plan}`))

  const emailCell = el('td', 'muted', license.email || '-')

  const sourceCell = el('td')
  sourceCell.append(
    badge(
      license.source === 'manual' ? 'Manual' : 'Stripe',
      `source-${license.source}`,
    ),
  )

  const issuedCell = el('td', 'muted', formatDate(license.issuedAt))

  const updatesCell = el('td', updatesActive(license) ? 'ok' : 'expired')
  updatesCell.textContent = formatDate(license.updatesUntil)

  const keyCell = el('td')
  keyCell.append(el('code', 'key-mask', maskKey(license.licenseKey)))

  const actionsCell = el('td', 'actions-col')
  const actions = el('div', 'row-actions')

  const copyButton = el('button', 'mini-button', 'Copy')
  copyButton.type = 'button'
  copyButton.addEventListener('click', () => {
    void copyText(license.licenseKey, 'License key copied.')
  })

  const viewButton = el('button', 'mini-button ghost', 'View')
  viewButton.type = 'button'
  viewButton.addEventListener('click', () => openDetail(license))

  actions.append(copyButton, viewButton)
  actionsCell.append(actions)

  row.append(
    companyCell,
    planCell,
    emailCell,
    sourceCell,
    issuedCell,
    updatesCell,
    keyCell,
    actionsCell,
  )
  row.addEventListener('dblclick', () => openDetail(license))
  return row
}

function renderTable() {
  const licenses = filteredLicenses()
  els.licenseBody.replaceChildren()

  if (state.licenses.length === 0) {
    els.tableWrap.hidden = true
    els.empty.hidden = false
    els.empty.querySelector('h2').textContent = 'No licenses found'
    els.empty.querySelector('p').textContent =
      'After a Stripe checkout, the license appears here automatically. You can also issue one manually.'
    els.resultCount.textContent = ''
    return
  }

  els.empty.hidden = licenses.length !== 0
  if (licenses.length === 0) {
    els.tableWrap.hidden = true
    els.empty.querySelector('h2').textContent = 'No matching licenses'
    els.empty.querySelector('p').textContent =
      'Try a different search term or clear the filters.'
    els.resultCount.textContent = ''
    return
  }

  const fragment = document.createDocumentFragment()
  for (const license of licenses) fragment.append(buildRow(license))
  els.licenseBody.append(fragment)
  els.tableWrap.hidden = false
  els.resultCount.textContent = `Showing ${licenses.length} of ${state.licenses.length} licenses`
}

function renderAll() {
  renderStats()
  renderTable()
}

function openIssueDialog() {
  els.issueForm.reset()
  els.issuePlan.value = 'standard'
  els.issueError.hidden = true
  els.issueError.textContent = ''
  els.issueDialog.showModal()
  els.issueCompany.focus()
}

async function submitIssue(event) {
  event.preventDefault()
  if (!state.token) return

  const company = els.issueCompany.value.trim()
  const email = els.issueEmail.value.trim()
  if (!company) {
    els.issueError.textContent = 'Enter a company name.'
    els.issueError.hidden = false
    els.issueCompany.focus()
    return
  }

  els.issueSubmit.disabled = true
  els.issueSubmit.textContent = 'Signing...'
  els.issueError.hidden = true

  const result = await window.licenseConsole.api({
    method: 'POST',
    path: '/api/trucktap/admin/licenses',
    token: state.token,
    body: { plan: els.issuePlan.value, company, email },
  })

  els.issueSubmit.disabled = false
  els.issueSubmit.textContent = 'Sign and issue'

  if (!result.ok) {
    els.issueError.textContent =
      result.error ||
      result.data?.error ||
      'The license could not be issued.'
    els.issueError.hidden = false
    return
  }

  const license = normalizeLicense(result.data.license)
  state.licenses.unshift(license)
  els.issueDialog.close()
  renderAll()
  toast(`Issued ${PLAN_LABELS[license.plan]} for ${license.company}.`)
  openDetail(license)
}

function detailValue(label, value, className) {
  const wrap = el('div', 'detail-item')
  wrap.append(el('span', 'detail-label', label))
  wrap.append(el('span', `detail-value ${className ?? ''}`, value))
  return wrap
}

function openDetail(license) {
  els.detailCompany.textContent = license.company
  els.detailBody.replaceChildren()

  const grid = el('div', 'detail-grid')
  grid.append(
    detailValue('Plan', PLAN_LABELS[license.plan] ?? license.plan, 'accent-text'),
    detailValue('Source', license.source === 'manual' ? 'Manual' : 'Stripe'),
    detailValue('Email', license.email || '-'),
    detailValue(
      'Van limit',
      Number(license.payload.maxVans) >= 9999
        ? 'Unlimited'
        : String(license.payload.maxVans ?? '-'),
    ),
    detailValue(
      'Shop stations',
      Number(license.payload.shopSeats) >= 9999
        ? 'Unlimited'
        : String(license.payload.shopSeats ?? '-'),
    ),
    detailValue(
      'Updates',
      updatesActive(license)
        ? `Active until ${formatDate(license.updatesUntil)}`
        : `Ended ${formatDate(license.updatesUntil)}`,
      updatesActive(license) ? 'ok' : 'expired',
    ),
    detailValue('Issued', formatDate(license.issuedAt)),
    detailValue('License ID', license.licenseId || '-'),
    detailValue('Session', license.sessionId),
  )
  els.detailBody.append(grid)

  els.detailBody.append(el('p', 'detail-label section-label', 'Signed license key'))
  const keyBox = document.createElement('textarea')
  keyBox.className = 'key-box'
  keyBox.readOnly = true
  keyBox.rows = 5
  keyBox.value = license.licenseKey
  els.detailBody.append(keyBox)

  const actions = el('div', 'detail-actions')
  const copy = el('button', 'button primary', 'Copy license key')
  copy.type = 'button'
  copy.addEventListener('click', () => {
    void copyText(license.licenseKey, 'License key copied.')
  })

  const copyEmail = el('button', 'button outline', 'Copy customer email')
  copyEmail.type = 'button'
  copyEmail.addEventListener('click', () => {
    void copyText(license.email || '', 'Customer email copied.')
  })

  actions.append(copy, copyEmail)
  els.detailBody.append(actions)
  els.detailBody.append(
    el(
      'p',
      'detail-hint',
      'Open TruckTap and choose License & Downloads, then paste this key to activate. The key is verified offline.',
    ),
  )

  els.detailDialog.showModal()
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

async function exportCsv() {
  const licenses = filteredLicenses()
  if (licenses.length === 0) {
    toast('There are no licenses to export.')
    return
  }

  const header = [
    'company',
    'email',
    'plan',
    'source',
    'issued_at',
    'updates_until',
    'license_id',
    'session_id',
    'license_key',
  ]
  const lines = [header.join(',')]
  for (const license of licenses) {
    lines.push(
      [
        license.company,
        license.email,
        license.plan,
        license.source,
        license.issuedAt,
        license.updatesUntil,
        license.licenseId,
        license.sessionId,
        license.licenseKey,
      ]
        .map(csvEscape)
        .join(','),
    )
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const result = await window.licenseConsole.exportCsv(
    `\ufeff${lines.join('\r\n')}`,
    `trucktap-licenses-${stamp}.csv`,
  )
  if (result.saved) toast('CSV exported.')
}

function wireEvents() {
  els.loginForm.addEventListener('submit', (event) => {
    event.preventDefault()
    void connect(els.tokenInput.value.trim(), {
      remember: els.rememberToken.checked,
    })
  })

  els.toggleToken.addEventListener('click', () => {
    const showing = els.tokenInput.type === 'text'
    els.tokenInput.type = showing ? 'password' : 'text'
    els.toggleToken.textContent = showing ? 'Show' : 'Hide'
  })

  els.lockButton.addEventListener('click', lock)
  els.refreshTop.addEventListener('click', () => void refresh())
  els.refreshButton.addEventListener('click', () => void refresh())
  els.retryButton.addEventListener('click', () => void refresh())

  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value
    renderTable()
  })
  els.planFilter.addEventListener('change', () => {
    state.plan = els.planFilter.value
    renderTable()
  })
  els.sourceFilter.addEventListener('change', () => {
    state.source = els.sourceFilter.value
    renderTable()
  })

  els.issueButton.addEventListener('click', openIssueDialog)
  els.emptyIssueButton.addEventListener('click', openIssueDialog)
  els.issueForm.addEventListener('submit', (event) => void submitIssue(event))
  els.exportButton.addEventListener('click', () => void exportCsv())

  for (const button of document.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => {
      document.getElementById(button.dataset.close)?.close()
    })
  }

  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close()
    })
  }
}

async function boot() {
  wireEvents()
  const saved = await window.licenseConsole.loadToken()
  if (saved) {
    els.tokenInput.value = saved
    await connect(saved, { remember: true, auto: true })
  }
}

void boot()
