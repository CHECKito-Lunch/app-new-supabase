import { supabase } from './supabase.js'

const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']

// ——  ☀️ Initialization ——————————————————————
document.addEventListener('DOMContentLoaded', async () => {
  const { data:{ session } } = await supabase.auth.getSession()
  supabase.auth.onAuthStateChange((_, s) => renderApp(s?.user))
  renderApp(session?.user)
})

// ——  🎯 Main router ————————————————————————
async function renderApp(user) {
  if (!user) return renderAuth()
  document.getElementById('authContainer').textContent = ''
  document.getElementById('mainContainer').style.display = 'block'

  // 🎫 Profile laden
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('firstname,lastname,location')
    .eq('id', user.id).single()
  if (profErr || !profile) {
    alert('⚠️ Profil fehlt oder ungültig. Bitte neu anmelden.')
    await supabase.auth.signOut()
    return location.reload()
  }

  await renderUserApp(user, profile)

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', user.id).single()

  console.log('🔐 Role check:', roleData)

  const adminEl = document.getElementById('adminApp')
  if (roleData?.role === 'admin') {
    adminEl.style.display = 'block'
    renderAdminApp()
  } else {
    adminEl.style.display = 'none'
  }
}

// 🔐 AUTH UI
function renderAuth() {
  document.getElementById('authContainer').innerHTML = `
    <h2>Login / Registrierung</h2>
    <div id="authMode">
      <div class="form-group"><input id="email" type="email" placeholder="Email"></div>
      <div class="form-group"><input id="password" type="password" placeholder="Passwort"></div>
      <div class="form-group"><button onclick="signin()">Login</button></div>
      <p>Noch kein Konto? <a href="#" onclick="showRegister()">Registrieren</a></p>
      <p><a href="#" onclick="resetPassword()">Passwort vergessen?</a></p>
      <div id="msg"></div>
    </div>`
}

window.signin = async () => {
  const e = document.getElementById('email').value
  const p = document.getElementById('password').value
  const { error } = await supabase.auth.signInWithPassword({ email: e, password: p })
  const msg = document.getElementById('msg')
  if (msg) msg.textContent = error ? error.message : 'Erfolgreich eingeloggt!'
}

window.showRegister = () => {
  document.getElementById('authContainer').innerHTML = `
    <h2>Registrierung</h2>
    <div class="form-group"><input id="firstname" placeholder="Vorname"></div>
    <div class="form-group"><input id="lastname" placeholder="Nachname"></div>
    <div class="form-group"><input id="email" type="email" placeholder="Email"></div>
    <div class="form-group"><input id="password" type="password" placeholder="Passwort"></div>
    <div class="form-group">
      <select id="regLocation">
        <option value="">Standort wählen</option>
        <option>Südpol</option>
        <option>Nordpol</option>
      </select>
    </div>
    <button onclick="signup()">Registrieren</button>
    <p><a href="#" onclick="renderAuth()">Zurück zum Login</a></p>
    <div id="msg"></div>`
}

window.signup = async () => {
  const firstname = document.getElementById('firstname').value.trim()
  const lastname = document.getElementById('lastname').value.trim()
  const email = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value.trim()
  const location = document.getElementById('regLocation').value
  if (!firstname || !lastname || !email || !password || !location) {
    return alert('Bitte alle Felder ausfüllen!')
  }

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return alert(error.message)

  // Profil erstellen
  await supabase.from('profiles').insert({
    id: data.user.id,
    firstname, lastname, location
  })

  // Rolle als user setzen (optional, wenn auto-insert nicht aktiv ist)
  await supabase.from('user_roles').upsert({
    id: data.user.id,
    role: 'user'
  })

  alert('Registriert! Bitte bestätige deine Email.')
  renderAuth()
}

window.resetPassword = async () => {
  const email = prompt('Bitte gib deine Email ein:')
  if (!email) return
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  alert(error ? error.message : 'Passwort-Zurücksetzen-Mail gesendet!')
}

window.signOut = async () => {
  await supabase.auth.signOut()
  location.reload()
}
// ——  👤 Nutzeransicht —————————————————————
async function renderUserApp(user, profile) {
  const name = `${profile.firstname} ${profile.lastname}`
  document.getElementById('userApp').innerHTML = `
    <h3>Hallo, ${profile.firstname}!</h3>
    <div><label>Name:</label><input id="nameInput" value="${name}" disabled></div>
    <div><label>Standort:</label>
      <select id="locationSelect">
        <option${profile.location==='Südpol' ? ' selected' : ''}>Südpol</option>
        <option${profile.location==='Nordpol' ? ' selected' : ''}>Nordpol</option>
      </select>
    </div>
    <div><label>Woche:</label><select id="weekSelect"></select>
    <button onclick="renderMenus()">Laden</button></div>
    <div id="menusContainer"></div>
    <button onclick="submitOrder()">Bestellung absenden/ändern</button>
    <div id="overview"></div>`

  const sel = document.getElementById('weekSelect')
  for (let i = 1; i <= 52; i++) sel.append(new Option('KW '+i, i))
}

// ——  🛠️ Adminansicht —————————————————————
function renderAdminApp() {
  document.getElementById('adminAppInner').innerHTML = `
    <button id="toggleViewBtn" onclick="toggleView()">🔄 Zur Benutzeransicht</button>
    <h3>🛠️ Menüs & Fristen verwalten</h3>
    <div>KW: <input id="menuWeek" type="number" min="1" max="52"></div>
    <div id="menuEditor"></div>
    <button onclick="renderMenuEditor()">Editor aktualisieren</button>
    <hr>
    <button onclick="exportOrders()">CSV-Export</button>
    <div id="exportLink"></div>
    <div id="adminOrders"></div>
    <div id="rolesManager"></div>`

  renderMenuEditor()
  renderAdminOrders()
  renderRoleManager()
}

async function renderMenuEditor() {
  const week = document.getElementById('menuWeek').value
  const { data: allM } = await supabase.from('menus').select('*').eq('week', week)
  const map = {}
  allM.forEach(m => { if (!map[m.weekday]) map[m.weekday] = []; map[m.weekday].push(m) })
  document.getElementById('menuEditor').innerHTML = days.map(day => {
    const rows = (map[day]||[]).map((m,i) => menuRow(day,m,i)).join('')
    return `<div><h4>${day}</h4><div id="menuList_${day}">${rows}</div>
      <button onclick="addMenuRow('${day}')">➕ Menü hinzufügen</button></div>`
  }).join('')
}

function menuRow(day, m={}, idx) {
  const valDL = m.deadline ? new Date(m.deadline).toISOString().slice(0,16) : ''
  return `<div data-day="${day}">
    <input class="menu-label" placeholder="Label" value="${m.menu_label||''}">
    <input class="menu-name" placeholder="Name" value="${m.menu_name||''}">
    <input class="menu-deadline" type="datetime-local" value="${valDL}">
    <button onclick="saveSingleMenu(this,'${day}','${m.id||''}')">💾</button>${m.id?`<button onclick="deleteMenu('${m.id}')">❌</button>`:''}
  </div>`
}

function addMenuRow(day) {
  document.getElementById(`menuList_${day}`).insertAdjacentHTML('beforeend', menuRow(day))
}

async function saveSingleMenu(b, day, id) {
  const r = b.closest('div[data-day]')
  const week = document.getElementById('menuWeek').value
  const label = r.querySelector('.menu-label').value
  const name = r.querySelector('.menu-name').value
  const dl = r.querySelector('.menu-deadline').value
  const { error } = await supabase.from('menus').upsert({
    id: id || undefined,
    week, weekday: day,
    menu_label: label,
    menu_name: name,
    deadline: dl ? new Date(dl).toISOString() : null
  })
  if (error) alert('Fehler: ' + error.message)
  renderMenuEditor()
}

async function deleteMenu(id) {
  if (confirm('Löschen?')) {
    const { error } = await supabase.from('menus').delete().eq('id', id)
    if (error) alert(error.message)
    renderMenuEditor()
  }
}

async function renderAdminOrders() {
  const { data } = await supabase.from('orders').select('*').order('week')
  document.getElementById('adminOrders').innerHTML = `
    <table><tr><th>User</th><th>KW</th><th>Ort</th><th>Tag</th><th>Menü</th></tr>` +
    data.map(o=>`<tr><td>${o.name}</td><td>${o.week}</td><td>${o.location}</td><td>${o.weekday}</td><td>${o.menu||'-'}</td></tr>`).join('') +
    `</table>`
}

async function renderRoleManager() {
  const { data: users } = await supabase.from('user_roles_with_email').select('id,email,role')
  document.getElementById('rolesManager').innerHTML = `
    <h3>🔧 Rollen</h3>
    <table>` +
    users.map(u=>`
      <tr><td>${u.email}</td>
      <td>
        <select onchange="updateUserRole('${u.id}',this.value)">
          <option value="user"${u.role==='user'?' selected':''}>user</option>
          <option value="admin"${u.role==='admin'?' selected':''}>admin</option>
        </select>
      </td></tr>`).join('') +
    `</table>`
}

async function updateUserRole(uid, nr) {
  const { error } = await supabase.from('user_roles').upsert({ id: uid, role: nr })
  if (error) alert(error.message)
}

async function exportOrders() {
  const { data, error } = await supabase.rpc('export_orders')
  if (error) return alert(error.message)
  const blob = new Blob([data], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  document.getElementById('exportLink').innerHTML = `<a href="${url}" download="orders.csv">Download CSV</a>`
}

// ——  USER BESTELLUNG ————————————————

async function renderMenus() {
  const week = document.getElementById('weekSelect').value
  const location = document.getElementById('locationSelect').value
  const { data: mdata } = await supabase.from('menus').select('*').eq('week', week)
  const map = {}
  mdata.forEach(m=>{ if(!map[m.weekday]) map[m.weekday]=[]; map[m.weekday].push(m) })

  const cont = document.getElementById('menusContainer')
  cont.innerHTML = ''
  days.forEach(day => {
    const sec = document.createElement('div')
    sec.className = 'menu-section'
    sec.innerHTML = `<h4>${day}</h4>`
    ;(map[day]||[]).forEach(m=>{
      const expired = m.deadline && Date.now()>new Date(m.deadline).getTime()
      const r = document.createElement('input')
      r.type='radio'; r.name=day; r.value=m.menu_name; r.disabled=expired; r.id=`${day}_${m.id}`
      const l = document.createElement('label')
      l.htmlFor = r.id; l.textContent = m.menu_name
      sec.append(r,l)
    })
    const rr = document.createElement('input')
    rr.type='radio'; rr.name=day; rr.value='__KEINESSEN__'; rr.id=`${day}_none`
    const ll = document.createElement('label')
    ll.htmlFor = rr.id; ll.textContent = 'Kein Essen'
    sec.append(rr,ll)
    cont.appendChild(sec)
  })
  setTimeout(loadPreviousSelections, 50)
}

async function loadPreviousSelections() {
  const name = document.getElementById('nameInput').value
  const week = document.getElementById('weekSelect').value
  if (!name || !week) return
  const { data } = await supabase.from('orders').select('weekday,menu')
    .eq('name', name).eq('week', week)
  data.forEach(o => {
    const val = o.menu || '__KEINESSEN__'
    const btn = document.querySelector(`input[name="${o.weekday}"][value="${val}"]`)
    if (btn) btn.checked = true
  })
}

async function submitOrder() {
  const name = document.getElementById('nameInput').value
  const week = document.getElementById('weekSelect').value
  const loc = document.getElementById('locationSelect').value
  if (!name || !week || !loc) return alert('Bitte alles ausfüllen!')
  const { data: mdata } = await supabase.from('menus').select('*').eq('week', week)
  const map = {}
  mdata.forEach(m=>{ if(!map[m.weekday]) map[m.weekday]=[]; map[m.weekday].push(m) })
  for (let day of days) {
    const btn = document.querySelector(`input[name="${day}"]:checked`)
    const expired = btn && map[day]?.find(m => m.menu_name=== btn.value)?.deadline
      && Date.now()>new Date(map[day].find(m=>m.menu_name===btn.value).deadline).getTime()
    if (!btn || expired) continue
    const menu = btn.value==='__KEINESSEN__' ? '' : btn.value
    const status = menu ? 'bestellt' : 'abbestellt'
    await supabase.from('orders').upsert({
      name, week, location: loc, weekday: day, menu, status
    }, { onConflict:['name','week','location','weekday'] })
  }
  alert('Bestellung gespeichert!')
  showOverview()
}

async function showOverview() {
  const name = document.getElementById('nameInput').value
  const week = document.getElementById('weekSelect').value
  if (!name || !week) return
  const { data } = await supabase.from('orders').select('weekday,menu,status')
    .eq('name', name).eq('week', week)
  const cont = document.getElementById('overview')
  if (!data.length) return cont.innerHTML = '<p>Keine Bestellungen</p>'
  cont.innerHTML = `<h3>Meine Bestellungen</h3><ul>` +
    data.map(o=>`<li>${o.weekday}: ${o.menu || '-'} (${o.status})</li>`).join('') +
    `</ul>`
}

// ——  🔁 Toggle Funktionen ————————————————————

function toggleUserView() {
  document.getElementById('adminApp').style.display = 'none'
  document.getElementById('userApp').scrollIntoView({ behavior: 'smooth' })
}

function toggleView() {
  const userApp = document.getElementById('userApp')
  const adminApp = document.getElementById('adminApp')
  const btn = document.getElementById('toggleViewBtn')
  if (adminApp.style.display === 'none') {
    adminApp.style.display = 'block'
    btn.textContent = '🔄 Zur Benutzeransicht'
  } else {
    adminApp.style.display = 'none'
    btn.textContent = '🔧 Zur Adminansicht'
    userApp.scrollIntoView({ behavior: 'smooth' })
  }
}

// ——  ⚙️ Globale Funktionen verfügbar machen für onclick —————

window.signin         = signin
window.signup         = signup
window.resetPassword  = resetPassword
window.signOut        = signOut
window.renderMenus    = renderMenus
window.submitOrder    = submitOrder
window.loadPreviousSelections = loadPreviousSelections
window.showOverview   = showOverview
window.renderMenuEditor = renderMenuEditor
window.addMenuRow     = addMenuRow
window.saveSingleMenu = saveSingleMenu
window.deleteMenu     = deleteMenu
window.exportOrders   = exportOrders
window.updateUserRole = updateUserRole
window.toggleUserView = toggleUserView
window.toggleView     = toggleView
