import { supabase } from './supabase.js'
const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']

// ☀️ Initialization
document.addEventListener('DOMContentLoaded', async () => {
  const { data:{ session } } = await supabase.auth.getSession()
  supabase.auth.onAuthStateChange((_, s) => renderApp(s?.user))
  renderApp(session?.user)
})

// ––– Main router
async function renderApp(user) {
  if (!user) return renderAuth()
  document.getElementById('authContainer').textContent = ''
  document.getElementById('mainContainer').style.display = 'block'

  const { data: profile, error: profErr } = await supabase
    .from('profiles').select('firstname,lastname,location').eq('id', user.id).single()
  if (profErr || !profile) {
    alert("⚠️ Profil fehlt oder ungültig. Bitte neu anmelden.")
    await supabase.auth.signOut(); return location.reload()
  }

  await renderUserApp(user, profile)

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('id', user.id).single()
  console.log("🔐 Role check:", roleData)

  const adminEl = document.getElementById('adminApp')
  if (roleData?.role === 'admin') {
    adminEl.style.display = 'block'
    renderAdminApp()
  } else {
    adminEl.style.display = 'none'
  }
}

// — Auth UI
function renderAuth() {
  document.getElementById('authContainer').innerHTML = `
    <h2>Login / Registrierung</h2>
    <div id="authMode">
      <div><input id="email" type="email" placeholder="Email"></div>
      <div><input id="password" type="password" placeholder="Passwort"></div>
      <button onclick="signin()">Login</button>
      <p><a href="#" onclick="showRegister()">Registrieren</a> | <a href="#" onclick="resetPassword()">Passwort vergessen?</a></p>
      <div id="msg"></div>
    </div>`
}

window.signin = async () => {
  const e = document.getElementById('email').value
  const p = document.getElementById('password').value
  const { error } = await supabase.auth.signInWithPassword({ email:e, password:p })
  const msg = document.getElementById('msg'); if (msg) msg.textContent = error ? error.message : 'Erfolgreich eingeloggt!'
}

window.showRegister = () => {
  document.getElementById('authContainer').innerHTML = `
    <h2>Registrierung</h2>
    <div><input id="firstname" placeholder="Vorname"></div>
    <div><input id="lastname" placeholder="Nachname"></div>
    <div><input id="email" type="email" placeholder="Email"></div>
    <div><input id="password" type="password" placeholder="Passwort"></div>
    <div><select id="regLocation"><option value="">Standort wählen</option><option>Südpol</option><option>Nordpol</option></select></div>
    <button onclick="signup()">Registrieren</button>
    <p><a href="#" onclick="renderAuth()">Zurück zum Login</a></p>
    <div id="msg"></div>`
}

window.signup = async () => {
  const fn = document.getElementById('firstname').value.trim()
  const ln = document.getElementById('lastname').value.trim()
  const em = document.getElementById('email').value.trim()
  const pw = document.getElementById('password').value.trim()
  const loc = document.getElementById('regLocation').value
  if (!fn||!ln||!em||!pw||!loc) return alert('Bitte alle Felder ausfüllen!')
  const { data, error } = await supabase.auth.signUp({ email:em, password:pw })
  if (error) return alert(error.message)
  await supabase.from('profiles').insert({ id:data.user.id, firstname:fn, lastname:ln, location:loc })
  alert('Registriert! Bitte bestätige Deine E‑Mail.')
  renderAuth()
}

window.resetPassword = async () => {
  const em = prompt('Bitte gib Deine Email ein:')
  if (!em) return
  const { error } = await supabase.auth.resetPasswordForEmail(em)
  alert(error ? error.message : 'Link zum Zurücksetzen gesendet!')
}

window.signOut = async () => {
  await supabase.auth.signOut()
  location.reload()
}

// — Nutzeransicht
async function renderUserApp(user, profile) {
  const name = `${profile.firstname} ${profile.lastname}`
  document.getElementById('userApp').innerHTML = `
    <h3>Hallo, ${profile.firstname}!</h3>
    <div><label>Name:</label><input id="nameInput" value="${name}" disabled></div>
    <div><label>Standort:</label><select id="locationSelect"><option${profile.location==='Südpol'?' selected':''}>Südpol</option><option${profile.location==='Nordpol'?' selected':''}>Nordpol</option></select></div>
    <div><label>Woche:</label><select id="weekSelect"></select><button onclick="renderMenus()">Laden</button></div>
    <div id="menusContainer"></div><button onclick="submitOrder()">Bestellung absenden/ändern</button><div id="overview"></div>
  `
  const sel=document.getElementById('weekSelect')
  for (let i=1;i<=52;i++) sel.append(new Option('KW '+i,i))
}

// — Adminansicht
function renderAdminApp() {
  document.getElementById('adminAppInner').innerHTML = `
    <h3>🛠️ Menüs verwalten</h3>
    <div>KW: <input id="menuWeek" type="number" min="1" max="52" value="28"></div>
    <div id="menuEditor"></div>
    <button onclick="renderMenuEditor()">Editor aktualisieren</button>
    <hr><button onclick="exportOrders()">CSV-Export</button><div id="exportLink"></div><div id="adminOrders"></div><div id="rolesManager"></div>`
  renderMenuEditor()
  renderAdminOrders()
  renderRoleManager()
}

window.renderMenuEditor = async () => {
  const week = document.getElementById('menuWeek').value
  const { data: allM } = await supabase.from('menus').select('*').eq('week',week)
  const map = {}
  allM.forEach(m=>{ if(!map[m.weekday]) map[m.weekday]=[]; map[m.weekday].push(m) })
  document.getElementById('menuEditor').innerHTML = days.map(day=>{
    const rows=(map[day]||[]).map((m,i)=>menuRow(day,m,i)).join('')
    return `<div><h4>${day}</h4><div id="menuList_${day}">${rows}</div><button onclick="addMenuRow('${day}')">➕ Menü hinzufügen</button></div>`
  }).join('')
}

function menuRow(day,m={},idx) {
  const valDL = m.deadline ? new Date(m.deadline).toISOString().slice(0,16) : ''
  return `<div data-day="${day}"><input class="menu-label" placeholder="Label" value="${m.menu_label||''}"><input class="menu-name" placeholder="Name" value="${m.menu_name||''}"><input class="menu-deadline" type="datetime-local" value="${valDL}"><button onclick="saveSingleMenu(this,'${day}','${m.id||''}')">💾</button>${m.id?`<button onclick="deleteMenu('${m.id}')">❌</button>`:''}</div>`
}

window.addMenuRow = day => {
  document.getElementById(`menuList_${day}`).insertAdjacentHTML('beforeend', menuRow(day))
}

window.saveSingleMenu = async (b,day,id) => {
  const r = b.closest('div[data-day]')
  const week=document.getElementById('menuWeek').value, label=r.querySelector('.menu-label').value, name=r.querySelector('.menu-name').value, dl=r.querySelector('.menu-deadline').value
  const { error } = await supabase.from('menus').upsert({ id:id||undefined, week, weekday:day, menu_label:label, menu_name:name, deadline:dl?new Date(dl).toISOString():null })
  if(error) return alert('Fehler: '+error.message)
  renderMenuEditor()
}

window.deleteMenu = async id => {
  if(confirm('Löschen?')) { const { error } = await supabase.from('menus').delete().eq('id',id); if(error) alert(error.message); renderMenuEditor() }
}

async function renderAdminOrders() {
  const { data } = await supabase.from('orders').select('*').order('week')
  document.getElementById('adminOrders').innerHTML = `<table><tr><th>User</th><th>KW</th><th>Ort</th><th>Tag</th><th>Menü</th></tr>` + data.map(o=>`<tr><td>${o.name}</td><td>${o.week}</td><td>${o.location}</td><td>${o.weekday}</td><td>${o.menu||'-'}</td></tr>`).join('') + `</table>`
}

async function renderRoleManager() {
  const { data: users } = await supabase.from('user_roles_with_email').select('id,email,role')
  document.getElementById('rolesManager').innerHTML = `<h3>🔧 Rollen</h3><table>${users.map(u=>`<tr><td>${u.email}</td><td><select onchange="updateUserRole('${u.id}',this.value)"><option value="user"${u.role==='user'?' selected':''}>user</option><option value="admin"${u.role==='admin'?' selected':''}>admin</option></select></td></tr>`).join('')}</table>`
}

window.updateUserRole = async (uid, nr) => {
  const { error } = await supabase.from('user_roles').upsert({ id:uid, role:nr })
  if(error) alert(error.message)
}

  document.getElementById('adminAppInner').innerHTML += `
    <hr>
    <button onclick="toggleUserView()">Zur Benutzeransicht wechseln</button>`

// BESTELLUNG USER

async function renderMenus() {
  const week=document.getElementById('weekSelect').value
  const { data: mdata } = await supabase.from('menus').select('*').eq('week',week)
  const map = {}
  mdata.forEach(m=>{ if(!map[m.weekday]) map[m.weekday]=[]; map[m.weekday].push(m) })
  const cont=document.getElementById('menusContainer')
  cont.innerHTML=''
  days.forEach(day=>{
    const sec=document.createElement('div'); sec.className='menu-section'; sec.innerHTML=`<h4>${day}</h4>`
    (map[day]||[]).forEach(m=>{
      const expired = m.deadline && Date.now()>new Date(m.deadline).getTime()
      const r=document.createElement('input'); r.type='radio'; r.name=day; r.value=m.menu_name; r.disabled=expired; r.id=`${day}_${m.id}`
      const l=document.createElement('label'); l.htmlFor=r.id; l.textContent=m.menu_name
      sec.append(r,l)
    })
    const rr=document.createElement('input'); rr.type='radio'; rr.name=day; rr.value='__KEINESSEN__'; rr.id=`${day}_none`
    const ll=document.createElement('label'); ll.htmlFor=rr.id; ll.textContent='Kein Essen'
    sec.append(rr,ll)
    cont.appendChild(sec)
  })
  setTimeout(loadPreviousSelections,50)
}

async function loadPreviousSelections() {
  const name=document.getElementById('nameInput').value, week=document.getElementById('weekSelect').value
  if(!name||!week) return
  const { data } = await supabase.from('orders').select('weekday,menu').eq('name',name).eq('week',week)
  data.forEach(o=>{
    const val=o.menu||'__KEINESSEN__'
    const btn=document.querySelector(`input[name="${o.weekday}"][value="${val}"]`)
    if(btn) btn.checked=true
  })
}

async function submitOrder() {
  const name=document.getElementById('nameInput').value, week=document.getElementById('weekSelect').value, location=document.getElementById('locationSelect').value
  if(!name||!week||!location) return alert('Bitte alles ausfüllen!')
  const { data: mdata } = await supabase.from('menus').select('*').eq('week',week)
  const map = {}; mdata.forEach(m=>{ if(!map[m.weekday]) map[m.weekday]=[]; map[m.weekday].push(m) })
  for(let day of days){
    const btn=document.querySelector(`input[name="${day}"]:checked`)
    const expired = map[day]?.find(m=>m.menu_name===btn?.value)?.deadline && Date.now()>new Date(map[day].find(m=>m.menu_name===btn.value).deadline).getTime()
    if(!btn||expired) continue
    const menu=btn.value==='__KEINESSEN__'?'':btn.value
    const status = menu?'bestellt':'abbestellt'
    await supabase.from('orders').upsert({ name, week, location, weekday:day, menu, status }, { onConflict:['name','week','location','weekday'] })
  }
  alert('Bestellung gespeichert!')
  showOverview()
}

async function showOverview() {
  const name=document.getElementById('nameInput').value, week=document.getElementById('weekSelect').value
  if(!name||!week) return
  const { data } = await supabase.from('orders').select('weekday,menu,status').eq('name',name).eq('week',week)
  const cont=document.getElementById('overview')
  if(!data.length) return cont.innerHTML='<p>Keine Bestellungen</p>'
  cont.innerHTML=`<h3>Meine Bestellungen</h3><ul>${data.map(o=>`<li>${o.weekday}: ${o.menu||'-'} (${o.status})</li>`).join('')}</ul>`
}

// Bereich umschalten

window.toggleUserView = () => {
  document.getElementById('adminApp').style.display = 'none'
  document.getElementById('userApp').scrollIntoView({ behavior: 'smooth' })
}
