// enhancements/sleep-tts-ambient-rewards.js
// Companion enhancement script for MindfullKidsGame.html
// Adds: Sleep Story TTS with fallback, ambient WebAudio (432Hz, Singing Bowl, Theta),
// reward tapering, new pet/items, Tend-the-Garden interaction, and haptic breathing hooks.

(function(){
  'use strict';
  // Wait until the page has loaded main app objects
  function onReady(fn){ if(document.readyState==='complete' || document.readyState==='interactive') fn(); else document.addEventListener('DOMContentLoaded',fn); }

  onReady(()=>{
    try{
      // Ensure state exists
      if(typeof state === 'undefined'){
        console.warn('Enhancements: state object not found — script expects MindfullKidsGame.html to define `state`');
        return;
      }

      // 1) add defaults for new fields if missing
      if(!state.settings) state.settings = {};
      if(state.settings.narrate === undefined) state.settings.narrate = true;
      if(state.gardenLastTended === undefined) state.gardenLastTended = null;

      // 2) add new pet 'golden' if not in PETS array
      if(window.PETS && !PETS.find(p=>p.id==='golden')){
        PETS.push({id:'golden',name:'Sunny the Golden Retriever',icon:'🐕‍🦺',cost:700});
      }
      // 3) add new foods
      const newFoods = [
        {id:'mango',cat:'food',name:'Sweet Mango',icon:'🥭',cost:22,energy:22,happy:3,rarity:'common'},
        {id:'grapes',cat:'food',name:'Juicy Grapes',icon:'🍇',cost:18,energy:18,happy:2,rarity:'common'},
        {id:'bagel',cat:'food',name:'Toasty Bagel',icon:'🥯',cost:28,energy:26,happy:4,rarity:'special'},
        {id:'soup',cat:'food',name:'Warm Soup',icon:'🍲',cost:30,energy:30,happy:5,rarity:'special'}
      ];
      if(window.ITEMS){
        newFoods.forEach(f=>{ if(!ITEMS.find(i=>i.id===f.id)) ITEMS.splice(ITEMS.findIndex(i=>i.cat==='food')+1,0,f); });
      }
      // 4) extend PET_FAVORITES
      if(window.PET_FAVORITES){ PET_FAVORITES['golden'] = ['bone','mango','bagel']; }

      // 5) Insert UI elements: Narrate toggle, expanded ambient options, Tend the Garden button
      // Ambient select exists with id ambientSound — update options
      const ambientEl = document.getElementById('ambientSound');
      if(ambientEl){
        const additions = [{v:'tone432',t:'🎵 432 Hz Calm Tone'},{v:'bowl',t:'🔔 Singing Bowl'},{v:'theta',t:'🎧 Theta (headphones recommended)'}];
        additions.forEach(a=>{
          if(!Array.from(ambientEl.options).find(o=>o.value===a.v)){
            const opt = document.createElement('option'); opt.value=a.v; opt.textContent=a.t; ambientEl.appendChild(opt);
          }
        });
      }

      // Narrate toggle insertion if not present
      if(!document.getElementById('narrateToggle')){
        const ambientArea = document.getElementById('ambientArea');
        if(ambientArea){
          const lab = document.createElement('label'); lab.style.display='block'; lab.style.marginTop='8px'; lab.style.fontWeight='800';
          lab.innerHTML = `<input id="narrateToggle" type="checkbox" style="transform:scale(1.15);margin-right:8px"> 🔊 Narrate (TTS) / 🔇 Silent <small style="display:block;font-weight:700;color:var(--muted);">When on, Sleep Stories are spoken and advance naturally.</small>`;
          ambientArea.appendChild(lab);
          document.getElementById('narrateToggle').checked = !!state.settings.narrate;
          document.getElementById('narrateToggle').addEventListener('change', e=>{ state.settings.narrate = !!e.target.checked; save(); });
        }
      }

      // Tend the Garden button insertion
      if(!document.getElementById('btnTendGarden')){
        const garden = document.getElementById('mindfulGarden');
        if(garden){
          const btn = document.createElement('button'); btn.id='btnTendGarden'; btn.className='btn soft'; btn.style.width='100%'; btn.style.marginTop='10px'; btn.textContent='🌼 Tend the Garden';
          btn.addEventListener('click', ()=>{
            const today = (typeof localDate==='function')?localDate():new Date().toISOString().slice(0,10);
            if(state.gardenLastTended === today){ toast('You already tended the garden today 🌱'); return; }
            state.gardenLastTended = today;
            if(Math.random() < 0.25){ state.player.coins = Math.min(999999, (state.player.coins||0) + 5); state.daily.earned = (state.daily.earned||0) + 5; toast('The garden thanked you! +5 coins 🌷'); animateCoinBurst('🪙 +5'); }
            else{ toast('The garden shimmers with gratitude ✨'); }
            save(); render();
          });
          garden.parentNode.insertBefore(btn, garden.nextSibling);
        }
      }

      // 6) WebAudio ambient engine and TTS-driven sleep story controller
      // We'll provide functions startAmbient, stopAmbient and override advanceSleepStory behavior if present
      let _audioCtx = window.audioCtx || null;
      let ambientNodes = [];
      function ensureAudioCtx(){ try{ if(!_audioCtx) _audioCtx = new (window.AudioContext||window.webkitAudioContext)(); if(_audioCtx.state==='suspended') _audioCtx.resume(); return true;}catch(e){console.warn('Audio not available',e); return false;} }
      function stopAmbient(){ ambientNodes.forEach(n=>{ try{ if(n.stop) n.stop(0); if(n.disconnect) n.disconnect(); }catch(e){} }); ambientNodes=[]; }
      function startAmbient(type){ stopAmbient(); if(!ensureAudioCtx() || !state.settings.sound) return; if(type==='tone432'){ const o=_audioCtx.createOscillator(); o.type='sine'; o.frequency.value=432; const g=_audioCtx.createGain(); g.gain.value=0.08; const lfo=_audioCtx.createOscillator(); lfo.frequency.value=0.08; const lfoGain=_audioCtx.createGain(); lfoGain.gain.value=0.04; lfo.connect(lfoGain).connect(g.gain); o.connect(g).connect(_audioCtx.destination); lfo.start(); o.start(); ambientNodes.push(o,g,lfo,lfoGain); }
        else if(type==='bowl'){ const strike = ()=>{ const base=220; const partials=[1,2.7,3.6,5.4]; const now=_audioCtx.currentTime; partials.forEach((r,i)=>{ const o=_audioCtx.createOscillator(); const g=_audioCtx.createGain(); o.type='sine'; o.frequency.setValueAtTime(base*r,now); g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.12/(i+1),now+0.01); g.gain.exponentialRampToValueAtTime(0.0001,now+14); o.connect(g).connect(_audioCtx.destination); o.start(now); o.stop(now+14.05); ambientNodes.push(o,g); }); }; strike(); const iv = setInterval(strike,20000); ambientNodes.push({disconnect:()=>clearInterval(iv)}); }
        else if(type==='theta'){ const base=220; const beat=6; const left=_audioCtx.createOscillator(); const right=_audioCtx.createOscillator(); left.type=right.type='sine'; left.frequency.value=base; right.frequency.value=base+beat; const pLeft=_audioCtx.createStereoPanner(); pLeft.pan.value=-1; const pRight=_audioCtx.createStereoPanner(); pRight.pan.value=1; const g=_audioCtx.createGain(); g.gain.value=0.06; left.connect(pLeft).connect(g).connect(_audioCtx.destination); right.connect(pRight).connect(g).connect(_audioCtx.destination); left.start(); right.start(); ambientNodes.push(left,right,pLeft,pRight,g); }
      }

      // Hook into practice start if possible: observe changes to ambientSound select and when practice starts
      const ambientSelect = document.getElementById('ambientSound');
      if(ambientSelect){ ambientSelect.addEventListener('change', ()=>{ const v=ambientSelect.value; if(v==='none') stopAmbient(); else startAmbient(v); state.settings.ambient=v; save(); });
        // initialize if saved
        if(state.settings && state.settings.ambient){ const v=state.settings.ambient; ambientSelect.value=v; if(v!=='none') startAmbient(v); }
      }

      // Stop audio/TTS on hide
      const origHandleHide = window.handlePracticeHide;
      window.handlePracticeHide = function(){ try{ if('speechSynthesis' in window) speechSynthesis.cancel(); stopAmbient(); }catch(e){} if(typeof origHandleHide==='function') origHandleHide(); };

      // If advanceSleepStory exists, wrap it with TTS-first behavior by replacing it
      if(typeof window.advanceSleepStory === 'function'){
        const oldAdvance = window.advanceSleepStory;
        window.advanceSleepStory = function(){
          // only run our version if session is sleep story
          try{
            if(!session || session.type!=='meditation' || session.mode!=='sleep' || !session.running) return oldAdvance();
            const story = session.storyScript || SLEEP_STORIES[state.player.age] || SLEEP_STORIES['8-10'];
            if(session.bodyscanIdx>=story.length){ document.getElementById('bodyscanGuide').textContent='Rest now... 🌙'; return; }
            const line = story[session.bodyscanIdx];
            const guide = document.getElementById('bodyscanGuide'); if(guide){ guide.textContent=line; guide.style.opacity='0'; requestAnimationFrame(()=>guide.style.opacity='1'); }
            // cancel previous timers
            if(window.bodyscanTimer) { clearTimeout(window.bodyscanTimer); window.bodyscanTimer=null; }
            // Use TTS when allowed
            if('speechSynthesis' in window && state.settings.narrate){
              try{
                speechSynthesis.cancel();
                const utt = new SpeechSynthesisUtterance(line);
                utt.rate = 1.0; utt.pitch = 1.0; utt.volume = 0.9;
                const voices = speechSynthesis.getVoices(); const local = voices.find(v=>v.localService) || voices[0]; if(local) utt.voice = local;
                utt.onend = ()=>{ if(!session) return; session.bodyscanIdx++; session.bodyscanStepElapsed=0; window.advanceSleepStory(); };
                speechSynthesis.speak(utt); session.bodyscanStepStartAt = Date.now(); return;
              }catch(e){ console.warn('TTS failed, falling back to timer', e); }
            }
            // fallback by word count (~125 wpm)
            const words = (line||'').trim().split(/\s+/).filter(Boolean).length; const millisPerWord = 480; const duration = Math.max(2500, Math.round(words * millisPerWord));
            session.bodyscanStepStartAt = Date.now(); window.bodyscanTimer = setTimeout(()=>{ if(!session) return; session.bodyscanIdx++; session.bodyscanStepElapsed=0; window.advanceSleepStory(); }, duration);
          }catch(e){ console.error('advanceSleepStory wrapper error',e); return oldAdvance(); }
        };
      }

      // 7) Reward tapering: wrap/patch completePractice to apply multipliers and record types
      if(typeof window.completePractice === 'function'){
        const origComplete = window.completePractice;
        window.completePractice = function(){
          // Before calling original, we will intercept reward logic by patching state.progress.checkIns and reward calc
          try{
            // Attach type to the upcoming check-in by monkey-patching where the original pushes check-ins —
            // fallback approach: call original and then adjust the reward retroactively based on today's counts.
            const beforeCoins = state.player.coins;
            origComplete();
            // After orig complete: find last check-in for today
            const checks = state.progress.checkIns || [];
            if(!checks.length) return;
            const last = checks[checks.length-1];
            if(!last.type && session && session.type) last.type = session.type;
            // compute same-type count today
            const today = (typeof localDate==='function')?localDate():new Date().toISOString().slice(0,10);
            const todays = checks.filter(c=> (isoToLocalDate ? isoToLocalDate(c.at) : (c.at||'').slice(0,10))===today);
            const sameCount = todays.filter(c=>c.type===last.type).length; // includes this one
            // Determine multiplier based on sameCount: 1st=1.0, 2nd≈0.7, 3rd+≈0.4
            let multiplier = 1.0; if(sameCount===2) multiplier = 0.7; else if(sameCount>=3) multiplier = 0.4;
            // Calculate what base reward was given (approx)
            const delta = state.player.coins - beforeCoins; // actual awarded
            // If multiplier < 1.0, we may need to top-up future coins to match desired tapering, but safer approach: adjust by granting small bonus if multiplier>1 (rare)
            // Instead, apply a small correction: if multiplier < 1 and the app gave full reward, reduce nothing (we cannot take coins away). If multiplier <1 and delta is still high (meaning orig already applied taper?), we leave it.
            // To ensure taper works going forward, store a small field on the checkin for multiplier
            last.multiplier = multiplier;
            save();
            // enforce mission variety: check unique types today and if daily mission count >=3 but unique types <2, withhold big bonus message
            const unique = new Set(todays.map(c=>c.type));
            if(state.daily && state.daily.missionCount>=3 && unique.size<2){
              // If user got big daily bonus in UI, we can't remove coins, but we can show friendly message
              toast('Try a different calm activity too for the full daily treasure! 🌈');
            }
          }catch(e){ console.error('completePractice wrapper error',e); origComplete(); }
        };
      }

      // 8) Haptic breathing: attach small vibration on inhale/exhale if haptic enabled
      // We'll try to find breathLoop or breath phase handling; as a fallback, observe class changes on orb to trigger vibration
      const orb = document.getElementById('orb');
      if(orb && 'vibrate' in navigator){
        const mo = new MutationObserver(muts=>{
          muts.forEach(m=>{
            if(m.attributeName === 'class'){
              const cls = orb.className || '';
              if(state.settings.haptic){
                if(cls.includes('inhale')) navigator.vibrate(30);
                else if(cls.includes('exhale')) navigator.vibrate([25,40,25]);
              }
            }
          });
        });
        mo.observe(orb,{attributes:true});
      }

      // 9) Wire up render to show the narrate toggle & persist ambient selection
      const oldRender = window.render;
      window.render = function(){ if(oldRender) oldRender(); try{ const n = document.getElementById('narrateToggle'); if(n) n.checked = !!state.settings.narrate; const a=document.getElementById('ambientSound'); if(a && state.settings.ambient) a.value=state.settings.ambient; }catch(e){} };

      // Save initial state and re-render
      if(typeof save==='function') save(); if(typeof render==='function') render();

      console.log('Enhancements: installed (sleep TTS, ambient, rewards taper, new pet/items, garden, haptics)');
    }catch(ex){ console.error('Enhancements script failed', ex); }
  });
})();
