(function(){
  const MAX_CHANCES = 3;
  const STORAGE_KEY = "brstats_progress_v1";
  const CSV_PATH = "questions.csv";

  const map = document.getElementById('brmap');
  const states = Array.from(document.querySelectorAll('#brmap .state'));
  const marker = document.getElementById('stateMarker');
  const hoverLabel = document.getElementById('hoverLabel');
  const gameTitle = document.getElementById('gameTitle');
  const questionText = document.getElementById('questionText');
  const answerLine = document.getElementById('answerLine');
  const answerText = document.getElementById('answerText');
  const sourceLink = document.getElementById('sourceLink');
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

  // ---- local (user's system) date, not UTC ----
  function localDateKey(d){
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function formatDate(iso){
    const [y,m,d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  const todayKey = localDateKey();

  // ---- tiny CSV parser (handles quoted fields) ----
  function parseCSV(text){
    const lines = text.trim().split(/\r?\n/);
    const rows = [];
    for(let i=1;i<lines.length;i++){ // skip header
      const line = lines[i];
      if(!line.trim()) continue;
      const fields = [];
      let cur = '', inQuotes = false;
      for(let j=0;j<line.length;j++){
        const ch = line[j];
        if(ch === '"'){
          if(inQuotes && line[j+1] === '"'){ cur += '"'; j++; }
          else inQuotes = !inQuotes;
        } else if(ch === ',' && !inQuotes){
          fields.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur);
      rows.push(fields);
    }
    return rows;
  }

  function rowsToQuestions(rows){
    return rows.map(f => {
      const [index, date, question, answer, source] = f;
      const idMatch = answer.match(/\(([A-Z]{2})\)/);
      return {
        index: index.trim(),
        date: date.trim(),
        prompt: question,
        answerLabel: answer,
        answerId: idMatch ? idMatch[1] : null,
        source: source
      };
    }).sort((a,b) => a.date.localeCompare(b.date));
  }

  function pickTodayQuestion(questions){
    // most recent question whose date <= today; before the first date, use the first
    let chosen = questions[0];
    for(const q of questions){
      if(q.date <= todayKey) chosen = q;
    }
    return chosen;
  }

  function findState(id){ return states.find(s => s.dataset.id === id); }

  let QUESTION = null;
  let progress = {};
  let attempts = [];
  let finished = false;

  function loadProgress(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
  }
  function saveProgress(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }catch(e){}
  }
  function persist(){
    progress[todayKey] = { attempts, finished, index: QUESTION.index };
    saveProgress();
  }

  function renderLifebar(){
    lifeSegs.forEach((seg, i) => {
      seg.classList.remove('correct','wrong');
      const a = attempts[i];
      if(a) seg.classList.add(a.correct ? 'correct' : 'wrong');
    });
  }

  function positionOverlay(el, stateEl){
    const cx = parseFloat(stateEl.dataset.cx);
    const cy = parseFloat(stateEl.dataset.cy);
    if(isNaN(cx) || isNaN(cy)) return false;
    const vb = map.viewBox.baseVal;
    el.style.left = (cx / vb.width * 100) + "%";
    el.style.top = (cy / vb.height * 100) + "%";
    return true;
  }

  function placeMarker(stateEl){
    if(!positionOverlay(marker, stateEl)) return;
    marker.textContent = "+";
    marker.classList.add('show');
  }

  function showHoverLabel(stateEl){
    if(!positionOverlay(hoverLabel, stateEl)) return;
    hoverLabel.textContent = stateEl.dataset.id;
    hoverLabel.classList.add('show');
  }

  function hideHoverLabel(){
    hoverLabel.classList.remove('show');
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

  function renderAnswerLine(){
    const won = attempts.some(a => a.correct);
    if(finished){
      answerLine.classList.add('show');
      answerLine.classList.toggle('is-wrong', !won);
      const correctState = findState(QUESTION.answerId);
      answerText.textContent = correctState ? `${correctState.dataset.name} (${correctState.dataset.id})` : QUESTION.answerLabel;
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
    resultMeta.textContent = `brstats#${QUESTION.index} (${formatDate(todayKey)})`;
    resultEmojis.innerHTML = "";
    buildEmojiData().forEach(state => {
      const span = document.createElement('span');
      if(state !== 'none') span.classList.add(state);
      resultEmojis.appendChild(span);
    });
    resultCard.classList.add('show');
  }

  function setMapInteractive(on){
    map.classList.toggle('game-live', on);
    states.forEach(s => s.classList.toggle('disabled', !on));
  }

  function endGame(){
    finished = true;
    persist();
    renderAnswerLine();
    renderResultCard();
    setMapInteractive(false);
    renderMapState();
    hideHoverLabel();
  }

  function handleGuess(stateEl){
    if(!QUESTION) return;
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

  function wireEvents(){
    states.forEach(s => {
      s.addEventListener('click', () => handleGuess(s));
      s.addEventListener('mouseenter', () => {
        if(s.classList.contains('disabled')) return;
        showHoverLabel(s);
      });
      s.addEventListener('mouseleave', hideHoverLabel);
    });
    helpBtn.addEventListener('click', () => helpOverlay.classList.add('show'));
    closeHelp.addEventListener('click', () => helpOverlay.classList.remove('show'));
    helpOverlay.addEventListener('click', (e) => { if(e.target === helpOverlay) helpOverlay.classList.remove('show'); });
    closeResult.addEventListener('click', () => resultCard.classList.remove('show'));

    copyBtn.addEventListener('click', () => {
      const text = `brstats#${QUESTION.index} (${formatDate(todayKey)})\n${buildEmojiText()}\nhttps://brstats.io`;
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
  }

  async function init(){
    wireEvents(); // attach listeners right away; handleGuess no-ops until QUESTION is loaded

    let text;
    try{
      const res = await fetch(CSV_PATH);
      text = await res.text();
    }catch(e){
      questionText.textContent = "Não foi possível carregar as perguntas (questions.csv). Sirva os arquivos por um servidor local/HTTP, não abrindo o HTML direto.";
      return;
    }

    const questions = rowsToQuestions(parseCSV(text));
    QUESTION = pickTodayQuestion(questions);

    gameTitle.textContent = `brstats.io#${QUESTION.index}`;
    questionText.textContent = QUESTION.prompt;
    sourceLink.href = QUESTION.source;

    progress = loadProgress();
    const today = progress[todayKey];
    attempts = today ? today.attempts.slice() : [];
    finished = today ? today.finished : false;

    setMapInteractive(!finished);
    renderMapState();
    renderLifebar();
    renderAnswerLine();
    renderResultCard();
  }

  init();
})();
