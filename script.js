(function(){
  // ---- Single hardcoded question (front-end only test) ----
  const QUESTION = {
    id: "876",
    prompt: "Qual o estado mais recentemente criado?",
    answerId: "TO"
  };
  const MAX_CHANCES = 3;
  const STORAGE_KEY = "branks_progress_v1";

  const todayKey = new Date().toISOString().slice(0,10);

  const map = document.getElementById('brmap');
  const states = Array.from(document.querySelectorAll('#brmap .state'));
  const marker = document.getElementById('stateMarker');
  const questionText = document.getElementById('questionText');
  const answerLine = document.getElementById('answerLine');
  const answerText = document.getElementById('answerText');
  const lifeSegs = Array.from(document.querySelectorAll('.life-seg'));
  const resultCard = document.getElementById('resultCard');
  const resultTitle = document.getElementById('resultTitle');
  const resultMeta = document.getElementById('resultMeta');
  const resultEmojis = document.getElementById('resultEmojis');
  const copyBtn = document.getElementById('copyBtn');
  const closeResult = document.getElementById('closeResult');
  const helpBtn = document.getElementById('helpBtn');
  const helpOverlay = document.getElementById('helpOverlay');
  const closeHelp = document.getElementById('closeHelp');

  questionText.textContent = QUESTION.prompt;

  function loadProgress(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
  }
  function saveProgress(data){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(e){}
  }

  let progress = loadProgress();
  let today = progress[todayKey];

  let attempts = today ? today.attempts.slice() : []; // [{id, correct}]
  let finished = today ? today.finished : false;

  function findState(id){ return states.find(s => s.dataset.id === id); }

  function renderLifebar(){
    lifeSegs.forEach((seg, i) => {
      seg.classList.remove('correct','wrong');
      const a = attempts[i];
      if(a) seg.classList.add(a.correct ? 'correct' : 'wrong');
    });
  }

  function renderMapState(){
    states.forEach(s => s.classList.remove('correct','wrong'));
    attempts.forEach(a => {
      const el = findState(a.id);
      if(el) el.classList.add(a.correct ? 'correct' : 'wrong');
    });
    if(finished){
      const correctEl = findState(QUESTION.answerId);
      if(correctEl){
        correctEl.classList.add('correct');
        placeMarker(correctEl);
      }
    } else {
      marker.classList.remove('show');
    }
  }

  function placeMarker(stateEl){
    const cx = parseFloat(stateEl.dataset.cx);
    const cy = parseFloat(stateEl.dataset.cy);
    if(isNaN(cx) || isNaN(cy)) return;
    const vb = map.viewBox.baseVal;
    const pctX = (cx / vb.width) * 100;
    const pctY = (cy / vb.height) * 100;
    marker.style.left = pctX + "%";
    marker.style.top = pctY + "%";
    marker.textContent = "+";
    marker.classList.add('show');
  }

  function renderAnswerLine(){
    const won = attempts.some(a => a.correct);
    if(finished){
      answerLine.classList.add('show');
      answerLine.classList.toggle('is-wrong', !won);
      const correctState = findState(QUESTION.answerId);
      answerText.textContent = correctState ? `${correctState.dataset.name} (${correctState.dataset.id})` : QUESTION.answerId;
    } else {
      answerLine.classList.remove('show');
    }
  }

  function buildEmojiData(){
    const out = [];
    for(let i=0;i<MAX_CHANCES;i++){
      const a = attempts[i];
      out.push(!a ? 'none' : (a.correct ? 'correct' : 'wrong'));
    }
    return out;
  }

  function buildEmojiText(){
    return buildEmojiData().map(s => s === 'none' ? '\u2b1b' : (s === 'correct' ? '\ud83d\udfe9' : '\ud83d\udfe5')).join('');
  }

  function renderResultCard(){
    if(!finished){ resultCard.classList.remove('show'); return; }
    const won = attempts.some(a => a.correct);
    resultTitle.textContent = won ? "Parabéns!!" : "Que pena!";
    resultMeta.textContent = `branks#${QUESTION.id} (${formatDate(todayKey)})`;
    resultEmojis.innerHTML = "";
    buildEmojiData().forEach(state => {
      const span = document.createElement('span');
      if(state !== 'none') span.classList.add(state);
      resultEmojis.appendChild(span);
    });
    resultCard.classList.add('show');
  }

  function formatDate(iso){
    const [y,m,d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function setMapInteractive(on){
    map.classList.toggle('game-live', on);
    states.forEach(s => s.classList.toggle('disabled', !on));
  }

  function persist(){
    progress[todayKey] = { attempts, finished };
    saveProgress(progress);
  }

  function endGame(){
    finished = true;
    persist();
    renderAnswerLine();
    renderResultCard();
    setMapInteractive(false);
    renderMapState();
  }

  function handleGuess(stateEl){
    if(finished) return;
    if(attempts.length >= MAX_CHANCES) return;
    const id = stateEl.dataset.id;
    const correct = id === QUESTION.answerId;
    attempts.push({ id, correct });
    persist();
    renderMapState();
    renderLifebar();

    if(correct || attempts.length >= MAX_CHANCES){
      endGame();
    }
  }

  states.forEach(s => {
    s.addEventListener('click', () => handleGuess(s));
  });

  helpBtn.addEventListener('click', () => helpOverlay.classList.add('show'));
  closeHelp.addEventListener('click', () => helpOverlay.classList.remove('show'));
  helpOverlay.addEventListener('click', (e) => { if(e.target === helpOverlay) helpOverlay.classList.remove('show'); });
  closeResult.addEventListener('click', () => resultCard.classList.remove('show'));

  copyBtn.addEventListener('click', () => {
    const text = `branks#${QUESTION.id} (${formatDate(todayKey)})\n${buildEmojiText()}\nhttps://branks.io`;
    const done = () => {
      copyBtn.textContent = "COPIADO!";
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = "COPIAR"; copyBtn.classList.remove('copied'); }, 1500);
    };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      done();
    }
  });

  // ---- init ----
  setMapInteractive(!finished);
  renderMapState();
  renderLifebar();
  renderAnswerLine();
  renderResultCard();
})();
