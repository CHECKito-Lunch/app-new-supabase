import { supabase } from './supabase.js'

const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']

// Initialisierung
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession()
  supabase.auth.onAuthStateChange((_, s) => renderApp(s?.user))
  renderApp(session?.user)
})

// App-Rendering je nach Status
async function renderApp(user) {
  if (!user) return renderAuth()
  document.getElementById('authContainer').textContent = ''
  document.getElementById('mainContainer').style.display = 'block'

  await renderUserApp(user)
  if (user.email === 'admin@example.com') {
    document.getElementById('adminApp').style.display = 'block'
    renderAdminApp()
  } else {
    document.getElementById('adminApp').style.display = 'none'
  }
}

// LOGIN / SIGNUP UI
function renderAuth() {
  document.getElementById('authContainer').innerHTML = `
    <h2>Login oder Registrierung</h2>
    <div class="form-group"><input id="email" type="email" placeholder="Email"></div>
    <div class="form-group"><input id="password" type="password" placeholder="Passwort"></div>
    <button onclick="signin()">Login</button>
    <button onclick="signup()">Registrieren</button>
    <div id="msg"></div>
  `
}
window.signin = async () => {
  const e = document.getElementById('email').value
  const p = document.getElementById('password').value
  const { error } = await supabase.auth.signInWithPassword({ email: e, password: p })
  document.getElementById('msg').textContent = error ? error.message : 'Erfolgreich eingeloggt!'
}
window.signup = async () => {
  const e = document.getElementById('email').value
  const p = document.getElementById('password').value
  const { error } = await supabase.auth.signUp({ email: e, password: p })
  document.getElementById('msg').textContent = error ? error.message : 'Registriert! Bitte bestätige Deine Mail.'
}
window.signOut = async () => {
  await supabase.auth.signOut()
  location.reload()
}

// Nutzerbereich rendern
function renderUserApp(user) {
  document.getElementById('userApp').innerHTML = `
    <h3>Hallo, ${user.email}</h3>
    <div class="form-group">
      <label>Name:</label>
      <input id="nameInput" value="${user.email}">
    </div>
    <div class="form-group">
      <label>Standort:</label>
      <select id="locationSelect">
        <option value="Südpol">Südpol</option>
        <option value="Nordpol">Nordpol</option>
      </select>
    </div>
    <div class="form-group">
      <label>Woche:</label>
      <select id="weekSelect"></select>
      <button onclick="renderMenus()">Laden</button>
    </div>
    <div id="menusContainer"></div>
    <button onclick="submitOrder()">Bestellung absenden / ändern</button>
    <div id="overview"></div>
  `
  const wsel = document.getElementById('weekSelect')
  for (let i = 1; i <= 52; i++) {
    const o = document.createElement('option')
    o.value = i; o.textContent = 'KW ' + i
    wsel.appendChild(o)
  }
}

// Adminbereich rendern
function renderAdminApp() {
  document.getElementById('adminAppInner').innerHTML = `
    <h3>🛠️ Menüs & Fristen verwalten</h3>
    <div class="form-group">KW: <input id="menuWeek" type="text" placeholder="z.B. 28"></div>
    <div id="menuForm"></div>
    <button onclick="saveMenus()">Speichern</button>
    <hr>
    <h3>📋 Bestellungen exportieren</h3>
    <button onclick="exportOrders()">CSV herunterladen</button>
    <div id="exportLink"></div>
    <h3>🧾 Alle Bestellungen</h3>
    <div id="adminOrders"></div>
  `
  const mf = document.getElementById('menuForm')
  mf.innerHTML = days.map(day => `
    <div class="form-group">
      <strong>${day}</strong><br>
      Menü 1: <input id="menu1_${day}" type="text"><br>
      Menü 2: <input id="menu2_${day}" type="text"><br>
      Frist (Datum & Zeit): <input id="deadline_${day}" type="datetime-local">
    </div>
  `).join('')
  renderAdminOrders()
}

// Admin: Menüverwaltung speichern
window.saveMenus = async () => {
  const week = document.getElementById('menuWeek').value.trim()
  if (!week) return alert('Bitte Woche eingeben!')
  for (const day of days) {
    const m1 = document.getElementById(`menu1_${day}`).value.trim()
    const m2 = document.getElementById(`menu2_${day}`).value.trim()
    const dl = document.getElementById(`deadline_${day}`).value
    const deadline = dl ? new Date(dl).toISOString() : null
    const { error } = await supabase.from('menus').upsert({
      week, weekday: day, menu_1: m1 || null,
      menu_2: m2 || null, deadline
    }, { onConflict: ['week', 'weekday'] })
    if (error) console.error('Error saveMenus:', error)
  }
  alert('Menüs & Fristen gespeichert!')
  renderAdminOrders()
}

// Admin: Bestellungen anzeigen
async function renderAdminOrders() {
  const { data, error } = await supabase.from('orders').select('*').order('week', { ascending: true })
  if (error) return console.error(error)
  document.getElementById('adminOrders').innerHTML = `
    <table>
      <tr><th>User</th><th>KW</th><th>Ort</th><th>Tag</th><th>Menü</th><th>Status</th></tr>
      ${data.map(o => `
        <tr>
          <td>${o.name}</td><td>${o.week}</td><td>${o.location}</td>
          <td>${o.weekday}</td><td>${o.menu || '-'}</td><td>${o.status}</td>
        </tr>`).join('')}
    </table>`
}

// Admin: CSV-Export
window.exportOrders = async () => {
  const { data, error } = await supabase.rpc('export_orders')
  if (error) return alert('Export-Fehler: ' + error.message)
  const blob = new Blob([data], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  document.getElementById('exportLink').innerHTML = `<a href="${url}" download="orders.csv">Download CSV</a>`
}

// Menüanzeige für Nutzer mit Fristen
async function renderMenus() {
  const week = document.getElementById('weekSelect').value
  document.getElementById('menusContainer').innerHTML = ''
  const { data: mdata } = await supabase.from('menus').select('*').eq('week', week)
  const map = {}
  (mdata || []).forEach(x => map[x.weekday] = x)

  days.forEach(day => {
    const cfg = map[day] || {}
    const dl = cfg.deadline ? new Date(cfg.deadline).getTime() : null
    const expired = dl && Date.now() > dl

    const sec = document.createElement('div')
    sec.className = 'menu-section' + (expired ? ' disabled' : '')
    sec.innerHTML = `<h4>${day}${expired ? ' (Bestellschluss vorbei)' : ''}</h4>`

    ;[cfg.menu_1, cfg.menu_2].filter(Boolean).concat('__KEINESSEN__').forEach((opt, i) => {
      const r = document.createElement('input')
      r.type = 'radio'; r.name = day; r.value = opt; r.disabled = expired; r.id = `${day}_${i}`
      const l = document.createElement('label'); l.htmlFor = r.id
      l.textContent = opt === '__KEINESSEN__' ? 'Kein Essen' : opt
      const w = document.createElement('div'); w.className = 'option-wrapper'
      w.append(r, l); sec.appendChild(w)
    })

    document.getElementById('menusContainer').appendChild(sec)
  })
  setTimeout(loadPreviousSelections, 50)
}

// Vorherige Auswahl vorauswählen
async function loadPreviousSelections() {
  const name = document.getElementById('nameInput').value.trim()
  const week = document.getElementById('weekSelect').value
  if (!name || !week) return
  const { data, error } = await supabase.from('orders').select('weekday,menu').eq('name', name).eq('week', week)
  if (error) return console.error(error)
  data.forEach(o => {
    const val = o.menu || '__KEINESSEN__'
    const btn = document.querySelector(`input[name="${o.weekday}"][value="${val}"]`)
    if (btn) btn.checked = true
  })
}

// Bestellung abschicken mit Frist-Prüfung
async function submitOrder() {
  const name = document.getElementById('nameInput').value.trim()
  const week = document.getElementById('weekSelect').value
  const loc = document.getElementById('locationSelect').value
  if (!name || !week || !loc) return alert('Alle Felder ausfüllen!')

  const { data: mdata } = await supabase.from('menus').select('*').eq('week', week)
  const map = {}; (mdata || []).forEach(x => map[x.weekday] = x)

  for (const day of days) {
    const btn = document.querySelector(`input[name="${day}"]:checked`)
    const cfg = map[day] || {}
    const dl = cfg.deadline ? new Date(cfg.deadline).getTime() : null
    if (!btn || (dl && Date.now() > dl)) continue
    const menu = btn.value === '__KEINESSEN__' ? '' : btn.value
    const status = btn.value === '__KEINESSEN__' ? 'abbestellt' : 'bestellt'
    const menu_number = menu.startsWith('Menü ') ? parseInt(menu.replace('Menü ', ''), 10) : 0
    await supabase.from('orders').upsert({
      name, week, location: loc,
      weekday: day, menu, status, menu_number
    }, { onConflict: ['name','week','location','weekday'] })
  }
  alert('Bestellung gespeichert ✅')
  showOverview()
}

// Übersicht anzeigen
async function showOverview() {
  const name = document.getElementById('nameInput').value.trim()
  const week = document.getElementById('weekSelect').value
  if (!name || !week) return
  const { data, error } = await supabase.from('orders').select('weekday,menu,status').eq('name', name).eq('week', week)
  if (error) return console.error(error)
  const cont = document.getElementById('overview')
  if (!data.length) return cont.innerHTML = '<p>Keine Bestellungen</p>'
  cont.innerHTML = `<h3>Meine Bestellungen</h3><ul>${data.map(x => `<li>${x.weekday}: ${x.menu || '-'} (${x.status})</li>`).join('')}</ul>`
}
