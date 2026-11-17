/* Sona, the voice guide. Self-contained widget. No API keys here.
   Set VOICE_PROXY_URL to the deployed Cloudflare Worker URL (e.g. https://sona-voice.<acct>.workers.dev/chat). */
const VOICE_PROXY_URL = "";
(function(){
  if (window.__sonaLoaded) return; window.__sonaLoaded = true;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canSpeak = 'speechSynthesis' in window;
  const css = `
  .sona-fab{position:fixed;right:18px;bottom:18px;z-index:80;width:40px;height:40px;border-radius:50%;border:1px solid #D4A24C99;
    background:radial-gradient(circle at 35% 30%,#0E1433d9,#040A10cc);color:#D4A24C;display:flex;align-items:center;justify-content:center;
    cursor:pointer;opacity:.62;box-shadow:0 2px 12px #0006;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
    transition:opacity .25s,transform .25s;animation:sonaFloat 6s ease-in-out infinite;padding:0}
  .sona-fab:hover,.sona-fab:focus-visible,.sona-fab.open{opacity:1}
  .sona-fab:focus-visible{outline:1px solid #5FD4CF;outline-offset:3px}
  .sona-fab svg{width:17px;height:17px}
  .sona-fab.listening{opacity:1;animation:sonaPulse 1.6s ease-out infinite}
  @keyframes sonaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
  @keyframes sonaPulse{0%{box-shadow:0 0 0 0 #D4A24C88}100%{box-shadow:0 0 0 14px #D4A24C00}}
  .sona-panel{position:fixed;right:18px;bottom:68px;z-index:81;width:320px;max-height:min(430px,70vh);display:none;flex-direction:column;
    background:#06101C;border:1px solid #D4A24C66;box-shadow:0 18px 50px #000a;isolation:isolate;color:#E6E0D5;font-family:Inter,system-ui,sans-serif;font-size:13.5px;border-radius:14px;overflow:hidden}
  .sona-panel.open{display:flex}
  .sona-panel::after{content:"";position:absolute;right:13px;bottom:-7px;width:12px;height:12px;background:#06101C;border-right:1px solid #D4A24C66;border-bottom:1px solid #D4A24C66;transform:rotate(45deg)}
  .sona-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px 14px;border-bottom:1px solid #D4A24C33}
  .sona-hd b{font-family:Cinzel,serif;font-weight:400;letter-spacing:.16em;font-size:12px;color:#D4A24C}
  .sona-hd small{display:block;color:#A9A296;font-size:10.5px;letter-spacing:.02em;margin-top:2px}
  .sona-x{background:none;border:0;color:#A9A296;font-size:18px;line-height:1;cursor:pointer;padding:4px 6px}
  .sona-x:hover{color:#D4A24C}
  .sona-log{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:8px;min-height:90px;overscroll-behavior:contain}
  .sona-m{max-width:88%;padding:8px 11px;border-radius:12px;line-height:1.45;white-space:pre-wrap}
  .sona-m.bot{background:#0B2A35;border:1px solid #1E8C9355;align-self:flex-start}
  .sona-m.me{background:#D4A24C22;border:1px solid #D4A24C44;align-self:flex-end}
  .sona-m.sys{align-self:center;color:#A9A296;font-style:italic;font-size:12px;text-align:center;background:none;padding:2px}
  .sona-in{display:flex;gap:6px;padding:9px 10px;border-top:1px solid #D4A24C33;align-items:center}
  .sona-in input{flex:1;min-width:0;background:#040A10;border:1px solid #D4A24C44;color:#E6E0D5;border-radius:18px;padding:8px 12px;font:inherit}
  .sona-in input:focus{outline:none;border-color:#D4A24C}
  .sona-b{width:32px;height:32px;flex:none;border-radius:50%;border:1px solid #D4A24C77;background:none;color:#D4A24C;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
  .sona-b:disabled{opacity:.35;cursor:default}
  .sona-b svg{width:15px;height:15px}
  .sona-b.listening{background:#D4A24C;color:#040A10;animation:sonaPulse 1.6s ease-out infinite}
  .sona-tts{display:flex;align-items:center;gap:5px;color:#A9A296;font-size:10.5px;cursor:pointer;user-select:none}
  .sona-tts input{accent-color:#D4A24C;margin:0}
  @media (max-width:900px){
    .sona-fab{bottom:78px;right:14px}
    .sona-panel{left:0;right:0;bottom:0;width:auto;max-height:46vh;border-radius:16px 16px 0 0;border-left:0;border-right:0;border-bottom:0}
    .sona-panel::after{display:none}
    .sona-panel::before{content:"";display:block;width:36px;height:4px;border-radius:2px;background:#D4A24C55;margin:7px auto 0}
  }
  @media (prefers-reduced-motion:reduce){.sona-fab,.sona-fab.listening,.sona-b.listening{animation:none}}`;
  const mic='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg>';
  const send='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2-7-8-1z"/></svg>';
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const fab=document.createElement('button'); fab.type='button'; fab.className='sona-fab'; fab.setAttribute('aria-label','Open the voice guide'); fab.setAttribute('aria-expanded','false'); fab.setAttribute('aria-controls','sona-panel'); fab.innerHTML=mic;
  const panel=document.createElement('div'); panel.className='sona-panel'; panel.id='sona-panel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Voice guide');
  panel.innerHTML=`<div class="sona-hd"><div><b>SONA · VOICE GUIDE</b><small>Ask anything about the sanctuary</small></div>
   <div style="display:flex;align-items:center;gap:8px">${canSpeak?'<label class="sona-tts"><input type="checkbox" checked> speak</label>':''}<button type="button" class="sona-x" aria-label="Close voice guide">×</button></div></div>
   <div class="sona-log" aria-live="polite"></div>
   <form class="sona-in"><button type="button" class="sona-b sona-mic" aria-label="Speak">${mic}</button><input type="text" placeholder="Type or tap the mic…" aria-label="Your message" maxlength="600"><button type="submit" class="sona-b" aria-label="Send">${send}</button></form>`;
  document.body.appendChild(panel); document.body.appendChild(fab);
  const log=panel.querySelector('.sona-log'), form=panel.querySelector('form'), input=form.querySelector('input'), micB=panel.querySelector('.sona-mic'), tts=panel.querySelector('.sona-tts input');
  const online=!!VOICE_PROXY_URL; const history=[]; let busy=false, rec=null, listening=false, greeted=false;
  const add=(t,c)=>{const d=document.createElement('div');d.className='sona-m '+c;d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight;return d};
  const say=t=>{if(!canSpeak||!tts||!tts.checked)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);const v=speechSynthesis.getVoices().find(v=>/en(-|_)(US|GB|AU)/i.test(v.lang)&&/female|samantha|karen|serena|google us/i.test(v.name))||speechSynthesis.getVoices().find(v=>/^en/i.test(v.lang));if(v)u.voice=v;u.rate=.98;u.pitch=1;speechSynthesis.speak(u)};
  function open(){panel.classList.add('open');fab.classList.add('open');fab.setAttribute('aria-expanded','true');
    if(!greeted){greeted=true;
      if(online){const g="Hello, I'm Sona, the sanctuary's voice guide. What brings you here today, and what would you most like to understand?";add(g,'bot');history.push({role:'assistant',content:g})}
      else{add("The voice guide is coming online soon. In the meantime, Jody, our Lead Concierge, is happy to help on WhatsApp.",'sys');input.disabled=true;micB.disabled=true;form.querySelector('[type=submit]').disabled=true;input.placeholder='Coming online soon…'}}
    setTimeout(()=>{if(!input.disabled)input.focus({preventScroll:true})},50)}
  function close(){stopRec();if(canSpeak)speechSynthesis.cancel();panel.classList.remove('open');fab.classList.remove('open');fab.setAttribute('aria-expanded','false');fab.focus({preventScroll:true})}
  fab.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();panel.classList.contains('open')?close():open()});
  panel.querySelector('.sona-x').addEventListener('click',e=>{e.preventDefault();close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('open')){e.stopPropagation();close()}},true);
  panel.addEventListener('click',e=>e.stopPropagation());
  async function ask(text){text=text.trim();if(!text||busy||!online)return;add(text,'me');history.push({role:'user',content:text});input.value='';busy=true;
    const w=add('…','bot');
    try{const r=await fetch(VOICE_PROXY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history.slice(-12)})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
      const reply=(j.reply||'').trim()||"Hmm, the waves swallowed my words. Could you say that once more?";
      w.textContent=reply;history.push({role:'assistant',content:reply});say(reply)}
    catch(err){w.className='sona-m sys';w.textContent=/429/.test(err.message)?"Let's take a breath together; too many questions at once. Try again in a minute?":"The guide is resting for a moment. Please try again, or WhatsApp Jody."}
    finally{busy=false;log.scrollTop=log.scrollHeight}}
  form.addEventListener('submit',e=>{e.preventDefault();ask(input.value)});
  function stopRec(){if(rec&&listening){try{rec.stop()}catch(_){}}listening=false;micB.classList.remove('listening');fab.classList.remove('listening')}
  if(!SR){micB.title='Voice input is not supported in this browser. Please type instead.';micB.disabled=true}
  micB.addEventListener('click',()=>{if(!SR||!online)return;if(listening){stopRec();return}
    if(canSpeak)speechSynthesis.cancel();
    rec=new SR();rec.lang=navigator.language||'en-US';rec.interimResults=true;rec.continuous=false;let final='';
    rec.onresult=e=>{let t='';for(const r of e.results){t+=r[0].transcript;if(r.isFinal)final=t}input.value=t};
    rec.onerror=e=>{stopRec();if(e.error==='not-allowed')add('Microphone permission was declined. You can type instead.','sys')};
    rec.onend=()=>{const t=final||input.value;stopRec();if(t.trim())ask(t)};
    try{rec.start();listening=true;micB.classList.add('listening');fab.classList.add('listening')}catch(_){stopRec()}});
})();
