(function(){
  var KEY = 'lafortuna_access_ok_v2';
  var today = new Date().toISOString().slice(0,10);
  if(localStorage.getItem(KEY) === today) return;

  document.documentElement.style.overflow = 'hidden';

  var gate = document.createElement('div');
  gate.id = 'accessGate';
  gate.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#0A1512;font-family:\'Plus Jakarta Sans\',system-ui,sans-serif';
  gate.innerHTML =
    '<form id="accessForm" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:44px 40px;width:320px;max-width:88%;text-align:center">' +
      '<div style="color:rgba(251,246,236,.95);font-size:1.05rem;font-weight:600;letter-spacing:.2px;margin-bottom:22px">Acceso restringido</div>' +
      '<input type="password" id="accessInput" placeholder="Clave de acceso" autocomplete="off" style="width:100%;padding:11px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#FBF6EC;font-size:.95rem;margin-bottom:12px;outline:none;text-align:center;transition:border-color .2s ease">' +
      '<button type="submit" style="width:100%;padding:11px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#FBF6EC;font-weight:600;font-size:.95rem;cursor:pointer;transition:background .2s ease">Entrar</button>' +
      '<div id="accessError" style="color:#E08A6B;font-size:.8rem;margin-top:14px;display:none">Clave incorrecta</div>' +
    '</form>';

  var style = document.createElement('style');
  style.textContent = '#accessInput:focus{border-color:rgba(227,168,59,.5)!important}#accessForm button:hover{background:rgba(255,255,255,.14)!important}';

  function mount(){
    document.body.prepend(style);
    document.body.prepend(gate);
    document.addEventListener('submit', function(e){
      if(e.target && e.target.id === 'accessForm'){
        e.preventDefault();
        var input = document.getElementById('accessInput');
        if(input.value === '2026'){
          localStorage.setItem(KEY, today);
          gate.remove();
          document.documentElement.style.overflow = '';
        }else{
          var err = document.getElementById('accessError');
          if(err) err.style.display = 'block';
          input.value = '';
          input.focus();
        }
      }
    });
  }
  if(document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
