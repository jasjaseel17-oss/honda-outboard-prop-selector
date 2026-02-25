(function(){
  const form = document.getElementById('calc-form');
  const resetBtn = document.getElementById('resetBtn');
  const outUscg = document.getElementById('uscgMax');
  const outRange = document.getElementById('hpRange');
  const outSpeed = document.getElementById('hpSpeed');
  const outModels = document.getElementById('hondaModels');
  const outProp = document.getElementById('propSuggestion');
  const tech = document.getElementById('techDetails');
  const results = document.getElementById('results');
  const shareLink = document.getElementById('shareLink');

  // Honda model lineup with nominal HP (simplified list)
  const HONDA_MODELS = [2.3, 5, 8, 9.9, 15, 20, 30, 40, 50, 60, 75, 90, 100, 115, 135, 150, 175, 200, 225, 250];

  function round5(n){return Math.round(n/5)*5;}

  // USCG max HP calculation (summary logic)
  function uscgMaxHP(lenFt, widthFt, hullType, steering){
    const F = lenFt * widthFt; // factor
    if(F <= 52){
      if(F <= 35) return 3;
      if(F <= 39) return hullType==='flat' ? 3 : 5;
      if(F <= 42) return hullType==='flat' ? 5 : 7.5;
      if(F <= 45) return hullType==='flat' ? 7.5 : 10;
      return hullType==='flat' ? 10 : 15;
    }
    let hp;
    if(steering==='remote20'){
      hp = (2*F) - 90;
    }else{
      hp = (hullType==='flat') ? (0.5*F - 15) : (0.8*F - 25);
    }
    return Math.max(3, round5(hp));
  }

  // Practical HP range estimation by use-case
  function practicalRange(weightLb, useCase){
    const divisors = {
      'displacement':[50, 35],
      'cruise':[40, 25],
      'work':[35, 20],
      'sport':[30, 15]
    };
    const [maxLbPerHp, minLbPerHp] = divisors[useCase];
    const minHp = weightLb / maxLbPerHp;
    const maxHp = weightLb / minLbPerHp;
    return [minHp, maxHp];
  }

  // Optional speed-based HP estimate (Crouch simplified)
  function speedToHP(weightLb, speedMph, hullConstant=180){
    if(!speedMph) return null;
    return weightLb * Math.pow(speedMph / hullConstant, 2);
  }

  function suggestHondaModels(hpMin, hpMax, uscgMax){
    const upper = Math.min(hpMax, uscgMax);
    const picks = HONDA_MODELS.filter(hp => hp >= hpMin*0.9 && hp <= upper*1.05);
    if(picks.length===0){
      const withinLegal = HONDA_MODELS.filter(hp => hp <= uscgMax);
      const target = (hpMin+hpMax)/2;
      withinLegal.sort((a,b)=>Math.abs(a-target)-Math.abs(b-target));
      return withinLegal.slice(0,2);
    }
    return picks.slice(0,4);
  }

  // BASIC propeller suggestion (rules-of-thumb by HP band + use-case tweaks)
  function suggestPropBasic(hp, useCase){
    let pitchMin, pitchMax, diaMin, diaMax;
    if(hp < 15){ pitchMin=6; pitchMax=8; diaMin=7; diaMax=8.25; }
    else if(hp < 30){ pitchMin=7; pitchMax=10; diaMin=7; diaMax=9; }
    else if(hp < 60){ pitchMin=10; pitchMax=14; diaMin=10.5; diaMax=13; }
    else if(hp < 115){ pitchMin=13; pitchMax=17; diaMin=13; diaMax=14; }
    else if(hp < 175){ pitchMin=15; pitchMax=19; diaMin=13.75; diaMax=15; }
    else if(hp < 225){ pitchMin=17; pitchMax=21; diaMin=14; diaMax=15.5; }
    else { pitchMin=19; pitchMax=23; diaMin=15; diaMax=16; }

    // use-case tweaks
    if(useCase==='work') { pitchMin-=1; pitchMax-=1; diaMin+=0.5; diaMax+=0.5; }
    if(useCase==='sport') { pitchMin+=1; pitchMax+=1; }
    if(useCase==='displacement') { pitchMin-=2; pitchMax-=2; diaMin+=0.5; diaMax+=0.5; }

    // sanitize
    pitchMin = Math.max(5, Math.round(pitchMin));
    pitchMax = Math.max(pitchMin, Math.round(pitchMax));
    diaMin = Math.round(diaMin*4)/4; // quarter-inch
    diaMax = Math.max(diaMin, Math.round(diaMax*4)/4);

    const notes = 'Start with 3-blade aluminum; verify WOT RPM within spec and adjust pitch ±1 if over/under-revving.';
    return {pitchMin, pitchMax, diaMin, diaMax, notes};
  }

  function formatHP(n){
    if(n===null || isNaN(n)) return '—';
    return (Math.round(n*10)/10).toString();
  }

  function onCalc(e){
    e.preventDefault();
    const L = parseFloat(document.getElementById('length').value);
    const W = parseFloat(document.getElementById('width').value);
    const G = parseFloat(document.getElementById('weight').value);
    const pax = parseInt(document.getElementById('passengers').value||'0',10);
    const hull = document.getElementById('hullType').value;
    const steer = document.getElementById('steering').value;
    const useCase = document.getElementById('useCase').value;
    const targetSpeed = parseFloat(document.getElementById('targetSpeed').value);

    if([L,W,G].some(isNaN)) return;

    const legal = uscgMaxHP(L,W,hull,steer);
    const [hpMin, hpMax] = practicalRange(G, useCase);
    const hpMinC = Math.max(3, hpMin);
    const hpMaxC = Math.max(hpMinC, Math.min(legal, hpMax));
    const hpSpeed = speedToHP(G, targetSpeed || null);

    outUscg.textContent = `${legal} HP (max legal)`;
    outRange.textContent = `${formatHP(hpMinC)} – ${formatHP(hpMaxC)} HP (practical)`;
    outSpeed.textContent = hpSpeed? `${formatHP(hpSpeed)} HP (to reach ~${targetSpeed} mph)` : '—';

    const picks = suggestHondaModels(hpMinC, hpMaxC, legal);
    outModels.textContent = picks.length? picks.map(hp=>`BF${hp}`).join(', ') : 'No model within legal limit';

    // choose a representative HP for prop suggestion
    const repHp = picks.length ? picks[Math.min(1, picks.length-1)] : (hpMinC+hpMaxC)/2;
    const prop = suggestPropBasic(repHp, useCase);
    outProp.textContent = `${prop.pitchMin}–${prop.pitchMax}" pitch, ${prop.diaMin}–${prop.diaMax}" diameter (3-blade). ${prop.notes}`;

    const details = [
      `<strong>Factor (L×W):</strong> ${(L*W).toFixed(1)}`,
      `<strong>Loaded weight:</strong> ${Math.round(G)} lb`,
      `<strong>Use case:</strong> ${useCase}`,
      hpSpeed? `<strong>Speed-based HP:</strong> ${formatHP(hpSpeed)} (C≈180)` : ''
    ].filter(Boolean).join('<br>');
    tech.innerHTML = details;

    // Build shareable URL
    const params = new URLSearchParams({L, W, G, pax, hull, steer, useCase, v: targetSpeed||''});
    const url = location.origin + location.pathname + '?' + params.toString();
    shareLink.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(url + '

' + outUscg.textContent + ' | ' + outRange.textContent + ' | Honda: ' + outModels.textContent + ' | Prop: ' + outProp.textContent);
    shareLink.download = 'outboard_calc_results.txt';

    results.hidden = false;
    window.scrollTo({top: results.offsetTop-8, behavior:'smooth'});
  }

  function onReset(){
    form.reset();
    results.hidden = true;
  }

  form.addEventListener('submit', onCalc);
  resetBtn.addEventListener('click', onReset);

  // Support deep-link prefill
  const qs = new URLSearchParams(location.search);
  if(qs.has('L')){
    document.getElementById('length').value = qs.get('L');
    document.getElementById('width').value = qs.get('W');
    document.getElementById('weight').value = qs.get('G');
    document.getElementById('passengers').value = qs.get('pax')||2;
    document.getElementById('hullType').value = qs.get('hull')||'other';
    document.getElementById('steering').value = qs.get('steer')||'remote20';
    document.getElementById('useCase').value = qs.get('useCase')||'cruise';
    document.getElementById('targetSpeed').value = qs.get('v')||'';
  }
})();
