// Lightweight, reusable top bar for all pages.
(function () {
    const css = `
  #topBar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 52px;
    background: #222;
    color: #fff;
    display: flex;
    align-items: center;
    padding: 0 20px;
    z-index: 1000;
    font-size: 14px;
    gap: 12px;
  }
  #topBar button {
    color: #fff;
background: none;
    border: none;
    cursor: pointer;
    margin-right: 16px;
    font-size: 14px;
  }
  #topBar .right {
    margin-left: auto;
    display: flex;
gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  body.withTopBar { padding-top: 72px; }
  .balance-chip {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255,255,255,0.08);
    white-space: nowrap;
  }
  .balance-you.positive { color: #2ecc71; }
  .balance-you.negative { color: #ff5252; }
  .balance-target { color: #f0c200; }
  #topUser { color: #fff; opacity: .9; }
  `;

    const html = `
  <div id="topBar" role="navigation" aria-label="Main">
<div style="font-size:16px;font-weight:bold;margin-right:10px;">Vak Store</div>
    <button type="button" data-nav="store">Store</button>
<button type="button" data-nav="history">Account History</button>
<button type="button" data-nav="ocm">OCM</button>
    <button type="button" data-nav="merchant">OCM Merchant</button>
    <button id="adminPanelBtn" style="display:none" type="button" data-nav="admin">Admin Panel</button>
    <div class="right">
      <span id="topBalance" class="balance-chip balance-you" style="display:none;"></span>
      <span id="topUser"></span>
      <button id="btnLogin" type="button">Login</button>
 <button id="btnLogout" type="button" style="display:none;">Logout</button>
    </div>
  </div>`;

    function ensureTopBar(){
    if(!document.getElementById('topBar')){
      const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);
  const wrap=document.createElement('div');wrap.innerHTML=html;
document.body.insertBefore(wrap.firstElementChild,document.body.firstChild);
 document.body.classList.add('withTopBar');
    }
  }

  const state={idToken:null,user:null,isAdmin:false,balanceBT:null};

  function displayName(u){
    if(!u) return '';
    const name=(u.playerName&&u.playerName.trim())||'';
    const email=(u.email&&u.email.trim())||'';
    if(name&&email) return `${name} (${email})`;
return email||name||'';
  }

  function updateTopBarAuth(){
    const logged=!!state.idToken;
    const admin=!!state.isAdmin;
    const balEl=document.getElementById('topBalance');
    const topUser=document.getElementById('topUser');
    const btnLogin=document.getElementById('btnLogin');
    const btnLogout=document.getElementById('btnLogout');
    const adminBtn=document.getElementById('adminPanelBtn');

    if(logged){
      const b=Number(state.balanceBT); const safe=isFinite(b)?b:0;
 if(balEl){
        balEl.style.display='inline-block';
        balEl.textContent=`Balance: ${safe.toFixed(0)} BT`;
  balEl.classList.remove('positive','negative');
   balEl.classList.add(safe>=0?'positive':'negative');
 }
  if(topUser) topUser.textContent=displayName(state.user);
      if(btnLogin) btnLogin.style.display='none';
      if(btnLogout) btnLogout.style.display='inline-block';
    } else {
      if(balEl){ balEl.style.display='none'; balEl.textContent=''; }
 if(topUser) topUser.textContent='';
      if(btnLogin) btnLogin.style.display='inline-block';
  if(btnLogout) btnLogout.style.display='none';
    }
if(adminBtn) adminBtn.style.display=admin?'inline-block':'none';
  }

  function scrollToGoogleButton(){
 // Prefer element with id="googleBtn" or any Google sign-in button container
 var el=document.getElementById('googleBtn') || document.querySelector('[data-google-login], .g_id_signin');
 if(el && el.scrollIntoView){
 el.scrollIntoView({behavior:'smooth',block:'center'});
 el.focus && el.focus();
 }
 }

  function wireTopbarEvents(){
    const root=document.getElementById('topBar');
    if(!root) return;
    root.addEventListener('click',ev=>{
  const btn=ev.target.closest('button');
  if(!btn) return;
if(btn.id==='btnLogin'){
 // Do NOT call google.accounts.id.prompt() here; just bring user to the main Google button.
 scrollToGoogleButton();
 return;
      }
 if(btn.id==='btnLogout'){
  if(typeof window.logout==='function') window.logout();
    state.idToken=null;state.user=null;state.isAdmin=false;state.balanceBT=null;
  if(window.clearSavedIdToken) window.clearSavedIdToken();
    updateTopBarAuth();
    return;
  }
      if(btn.dataset&&btn.dataset.nav){
   const nav=btn.dataset.nav;
        if(nav==='store') window.location.href='index.html';
    else if(nav==='history') window.location.href='AccountHistory.html';
    else if(nav==='ocm') window.location.href='OCMHome.html';
  else if(nav==='merchant') window.location.href='OCMUser.html';
   else if(nav==='admin'){
    if(!state.idToken||!state.isAdmin){alert('Admin only');return;}
    window.location.href='Admin.html';
  }
 }
    });
  }

  // Page calls this whenever auth or balance changes
  window.topbarSetAuthState=function(info){
    state.idToken=info&&info.idToken||null;
    state.user=info&&info.user||null;
    state.isAdmin=!!(info&&info.isAdmin);
    state.balanceBT=(info&&info.balanceBT!=null)?info.balanceBT:null;
    updateTopBarAuth();
  };

  window.initSharedTopBar=function(){
    ensureTopBar();
wireTopbarEvents();
    updateTopBarAuth();
  };
})();