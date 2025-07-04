import { supabase } from './supabase.js'

const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']

// ☀️ Initialization
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession()
  supabase.auth.onAuthStateChange((_, s) => renderApp(s?.user))
  renderApp(session?.user)
})

// 🎯 Main router
async function renderApp(user) {
  if (!user) return renderAuth()

  document.getElementById('authContainer').textContent = ''
  document.getElementById('mainContainer').style.display = 'block'

  // 📥 Load user profile
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('firstname, lastname, location')
    .eq('id', user.id)
    .single()

  if (profErr || !profile) {
    alert("⚠️ Profil fehlt oder Fehler beim Laden. Bitte neu registrieren oder Admin informieren.")
    await supabase.auth.signOut()
    location.reload()
    return
  }

  await renderUserApp(user, profile)

  // 🔍 Load user role
  const { data: roleData, error: roleErr } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', user.id)
    .single()

  console.log("🔐 Role check:", { roleData, roleErr })

  const adminEl = document.getElementById('adminApp')
  if (roleData?.role === 'admin') {
    adminEl.style.display = 'block'
    renderAdminApp()
  } else {
    adminEl.style.display = 'none'
  }
}

// 🛂 Authentication UI
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
  await supabase.from('profiles').insert({
    id: data.user.id,
    firstname, lastname, location
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

// 👤 Render user panel
async function renderUserApp(user, profile) {
  const name = `${profile.firstname} ${profile.lastname}`
  document.getElementById('userApp').innerHTML = `
    <h3>Hallo, ${profile.firstname}!</h3>
    <div class="form-group">
      <label>Name:</label>
      <input id="nameInput" value="${name}" disabled>
    </div>
    <div class="form-group">
      <label>Standort:</label>
      <select id="locationSelect">
        <option${profile.location === 'Südpol' ? ' selected' : ''}>Südpol</option>
        <option${profile.location === 'Nordpol' ? ' selected' : ''}>Nordpol</option>
      </select>
    </div>
    <div class="form-group">
      <label>Woche:</label>
      <select id="weekSelect"></select>
      <button onclick="renderMenus()">Laden</button>
    </div>
    <div id="menusContainer"></div>
    <button onclick="submitOrder()">Bestellung absenden / ändern</button>
    <div id="overview"></div>`
  const sel = document.getElementById('weekSelect')
  for (let i = 1; i <= 52; i++) sel.append(new Option('KW ' + i, i))
}

// 🛠️ Admin panel + menu, roles, export
function renderAdminApp() {
  document.getElementById('adminAppInner').innerHTML = `
    <h3>🛠️ Menüs & Fristen verwalten</h3>
    <div class="form-group">KW: <input id="menuWeek" placeholder="z.B. 28"></div>
    <div id="menuForm"></div>
    <button onclick="saveMenus()">Speichern</button>
    <hr>
    <h3>📋 Bestellungen exportieren</h3>
    <button onclick="exportOrders()">CSV herunterladen</button>
    <div id="exportLink"></div>
    <h3>🧾 Bestellungen</h3>
    <div id="adminOrders"></div>
    <hr>
    <h3>🔧 Rollen verwalten</h3>
    <div id="rolesManager"></div>`

  document.getElementById('menuForm').innerHTML = days.map(day => `
    <div class="form-group">
      <strong>${day}</strong><br>
      Menü 1: <input id="menu1_${day}"><br>
      Menü 2: <input id="menu2_${day}"><br>
      Frist: <input id="deadline_${day}" type="datetime-local">
    </div>`).join('')

  renderAdminOrders()
  renderRoleManager()
}

window.saveMenus = async () => {
  const week = document.getElementById('menuWeek').value.trim()
  if (!week) return alert('KW fehlt!')
  for (let day of days) {
    const m1 = document.getElementById(`menu1_${day}`).value.trim()
    const m2 = document.getElementById(`menu2_${day}`).value.trim()
    const dl = document.getElementById(`deadline_${day}`).value
    const deadline = dl ? new Date(dl).toISOString() : null
    await supabase.from('menus').upsert({ week, weekday: day, menu_1: m1 || null, menu_2: m2 || null, deadline }, { onConflict: ['week','weekday'] })
  }
  alert('Menüs & Fristen gespeichert!')
  renderAdminOrders()
}

async function renderAdminOrders() {
  const { data, error } = await supabase.from('orders').select('*').order('week')
  if (error) return console.error(error)
  document.getElementById('adminOrders').innerHTML = `
    <table><tr><th>User</th><th>KW</th><th>Ort</th><th>Tag</th><th>Menü</th><th>Status</th></tr>` +
      data.map(o => `<tr><td>${o.name}</td><td>${o.week}</td><td>${o.location}</td><td>${o.weekday}</td><td>${o.menu || '-'}</td><td>${o.status}</td></tr>`).join('') +
    `</table>`
}

window.exportOrders = async () => {
  const { data, error } = await supabase.rpc('export_orders')
  if (error) return alert(error.message)
  const blob = new Blob([data], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  document.getElementById('exportLink').innerHTML = `<a href="${url}" download="orders.csv">Download CSV</a>`
}

async function renderRoleManager() {
  const { data: users, error } = await supabase
    .from('user_roles_with_email')
    .select('id, email, role')
  if (error) return console.error(error)

  const rows = users.map(u => `
    <tr>
      <td>${u.email}</td>
      <td><select onchange="updateUserRole('${u.id}', this.value)">
        <option value="user"${u.role==='user'?' selected':''}>user</option>
        <option value="admin"${u.role==='admin'?' selected':''}>admin</option>
      </select></td>
    </tr>`).join('')

  document.getElementById('rolesManager').innerHTML = `
    <table><tr><th>Email</th><th>Rolle</th></tr>${rows}</table>`
}

window.updateUserRole = async (userId, newRole) => {
  const { error } = await supabase.from('user_roles').upsert({ id: userId, role: newRole })
  if (error) return alert(error.message)
  alert('Rolle aktualisiert!')
}

async function renderMenus() {
  const week = document.getElementById('weekSelect').value
  const location = document.getElementById('locationSelect').value
  const { data: mdata } = await supabase.from('menus').select('*').eq('week', week)
  const map = {}
  mdata.forEach(x => map[x.weekday] = x)

  const cont = document.getElementById('menusContainer')
  cont.innerHTML = ''

  days.forEach(day => {
    const cfg = map[day] || {}
    const expired = cfg.deadline && Date.now() > new Date(cfg.deadline).getTime()

    const sec = document.createElement('div')
    sec.className = 'menu-section' + (expired ? ' disabled' : '')
    sec.innerHTML = `<h4>${day}${expired?' (geschlossen)':''}</h4>`

    ;[cfg.menu_1, cfg.menu_2].filter(Boolean).concat('__KEINESSEN__').forEach((opt, i) => {
      const r = document.createElement('input')
      r.type='radio'; r.name=day; r.value=opt; r.disabled=expired; r.id=`${day}_${i}`
      const l = document.createElement('label'); l.htmlFor = r.id
      l.textContent = opt==='__KEINESSEN__' ? 'Kein Essen' : opt
      const w = document.createElement('div'); w.className='option-wrapper'; w.append(r,l)
      sec.appendChild(w)
    })

    cont.appendChild(sec)
  })

  setTimeout(loadPreviousSelections, 50)
}

async function loadPreviousSelections() {
  const name = document.getElementById('nameInput').value
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

async function submitOrder() {
  const name = document.getElementById('nameInput').value
  const week = document.getElementById('weekSelect').value
  const location = document.getElementById('locationSelect').value
  if (!name || !week || !location) return alert('Bitte alles ausfüllen!')

  const { data: mdata } = await supabase.from('menus').select('*').eq('week', week)
  const map = {}
  mdata.forEach(x => map[x.weekday] = x)

  for (let day of days) {
    const btn = document.querySelector(`input[name="${day}"]:checked`)
    const cfg = map[day] || {}
    const expired = cfg.deadline && Date.now() > new Date(cfg.deadline).getTime()
    if (!btn || expired) continue

    const menu = btn.value === '__KEINESSEN__' ? '' : btn.value
    const status = btn.value === '__KEINESSEN__' ? 'abbestellt' : 'bestellt'
    const num = menu.startsWith('Menü ') ? parseInt(menu.replace('Menü ',''),10) : 0

    await supabase.from('orders').upsert({
      name, week, location, weekday: day, menu, status, menu_number: num
    }, { onConflict:['name','week','location','weekday'] })
  }

  alert('Bestellung gespeichert!')
  showOverview()
}

async function showOverview() {
  const name = document.getElementById('nameInput').value
  const week = document.getElementById('weekSelect').value
  if (!name || !week) return

  const { data, error } = await supabase.from('orders').select('weekday,menu,status').eq('name', name).eq('week', week)
  if (error) return console.error(error)

  const cont = document.getElementById('overview')
  if (!data.length) return cont.innerHTML = '<p>Keine Bestellungen</p>'
  cont.innerHTML = `<h3>Meine Bestellungen</h3><ul>` +
    data.map(o => `<li>${o.weekday}: ${o.menu || '-'} (${o.status})</li>`).join('') + `</ul>`
}
