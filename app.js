import { supabase } from './supabase.js'

const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']

// Initialisierung
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session }} = await supabase.auth.getSession()
  supabase.auth.onAuthStateChange((_, session) => renderApp(session?.user))
  renderApp(session?.user)
})

// Auth-Status prüfen
async function renderApp(user) {
  if (!user) {
    renderAuth()
  } else {
    document.getElementById('authContainer').innerHTML = ''
    document.getElementById('mainContainer').style.display = 'block'
    renderUserApp(user)
    if (user.email === 'admin@example.com') await renderAdminApp()
  }
}

// Login/Signup anzeigen
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

// Auth-Funktionen
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
  document.getElementById('msg').textContent = error ? error.message : 'Registriert! Bestätige bitte deine Mail.'
}

// Logout
window.signOut = async () => {
  await supabase.auth.signOut()
  location.reload()
}

// Benutzer-Bereich rendern
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
  const w = document.getElementById('weekSelect')
  for(let i = 27; i <= 40; i++) {
    const o = document.createElement('option')
    o.value = i; o.textContent = 'KW ' + i
    w.appendChild(o)
  }
}

// Menüs rendern und Auswahl laden
function renderMenus() {
  const container = document.getElementById('menusContainer')
  container.innerHTML = ''
  for (const day of days) {
    const section = document.createElement('div')
    section.className = 'menu-section'
    section.innerHTML = `<h4>${day}</h4>`
    ['Menü 1','Menü 2','__KEINESSEN__'].forEach((opt, i) => {
      const radio = document.createElement('input')
      radio.type = 'radio'; radio.name = day; radio.value = opt
      radio.id = `${day}_${i}`
      const label = document.createElement('label')
      label.htmlFor = radio.id
      label.textContent = (opt === '__KEINESSEN__') ? 'Kein Essen' : opt
      const wrapper = document.createElement('div')
      wrapper.className = 'option-wrapper'
      wrapper.append(radio, label)
      section.appendChild(wrapper)
    })
    container.appendChild(section)
  }
  setTimeout(loadPreviousSelections, 50)
}

// Auswahl laden
async function loadPreviousSelections() {
  const name = document.getElementById('nameInput').value
  const week = document.getElementById('weekSelect').value
  if (!name || !week) return

  const { data, error } = await supabase
    .from('orders')
    .select('weekday, menu')
    .eq('name', name)
    .eq('week', week)

  if (error) return console.error(error)
  data.forEach(o => {
    const val = o.menu || '__KEINESSEN__'
    const btn = document.querySelector(`input[name="${o.weekday}"][value="${val}"]`)
    if (btn) btn.checked = true
  })
}

// Bestellung speichern
async function submitOrder() {
  const name = document.getElementById('nameInput').value.trim()
  const week = document.getElementById('weekSelect').value
  const location = document.getElementById('locationSelect').value
  if (!name || !week || !location) return alert('Bitte alle Felder ausfüllen.')

  for (const day of days) {
    const btn = document.querySelector(`input[name="${day}"]:checked`)
    if (!btn) continue
    const menu = btn.value === '__KEINESSEN__' ? '' : btn.value
    const status = btn.value === '__KEINESSEN__' ? 'abbestellt' : 'bestellt'
    const menu_number = menu.startsWith('Menü ') ? parseInt(menu.replace('Menü ',''), 10) : 0

    const { error } = await supabase
      .from('orders')
      .upsert({
        name, week, location,
        weekday: day, menu, status, menu_number
      }, { onConflict: ['name','week','location','weekday'] })
    if (error) console.error('Fehler:', error)
  }

  alert('Bestellung gespeichert.')
  await showOverview()
}

// Übersicht anzeigen
async function showOverview() {
  const name = document.getElementById('nameInput').value.trim()
  const week = document.getElementById('weekSelect').value
  if (!name || !week) return

  const { data, error } = await supabase
    .from('orders')
    .select('weekday, menu, status')
    .eq('name', name)
    .eq('week', week)

  if (error) return console.error(error)
  const container = document.getElementById('overview')
  if (!data.length) {
    container.innerHTML = '<p>Keine Bestellungen</p>'
  } else {
    container.innerHTML = '<h3>Meine Bestellungen</h3>' +
      '<ul>' + data.map(o => 
        `<li>${o.weekday}: ${o.menu || '-'} (${o.status})</li>`
      ).join('') + '</ul>'
  }
}

// Admin-Dashboard
async function renderAdminApp() {
  document.getElementById('adminApp').style.display = 'block'
  const { data, error } = await supabase.from('orders').select('*')
  if (error) return console.error(error)

  const html =
    `<table><tr>
       <th>User</th><th>Week</th><th>Loc</th>
       <th>Day</th><th>Menu</th><th>Status</th>
     </tr>` +
    data.map(o =>
      `<tr>
         <td>${o.name}</td><td>${o.week}</td><td>${o.location}</td>
         <td>${o.weekday}</td><td>${o.menu || '-'}</td><td>${o.status}</td>
       </tr>`
    ).join('') +
    `</table>`
  document.getElementById('adminOrders').innerHTML = html
}
