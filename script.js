'use strict';

// ============================================================
// TIMER HANDLES — cleared before any navigation
// ============================================================
const timers = { phase: null, card: null };

function clearTimers() {
  clearTimeout(timers.phase);
  clearInterval(timers.card);
  timers.phase = null;
  timers.card = null;
}

// ============================================================
// DATA — ROLES
// ============================================================

const ROLES = {
  liar: {
    id: 'liar',
    name: 'Liar',
    style: "Mirror the room. But when it helps, redirect suspicion toward one specific person. Plant doubt — don't broadcast it.",
    goal: "Cast doubt on one specific person. Make the group question them more than they question you.",
    win: "You're not the top vote in Most Suspicious. Someone else takes that spot."
  },
  analyst: {
    id: 'analyst',
    name: 'Analyst',
    style: "Watch for six signals: deflection (answering questions with questions), hedging (soft commitments), over-explanation, selective silence, premature accusation, inconsistency.",
    goal: "Find the one person whose behavioral signals don't add up. That's the Liar.",
    win: "Your Most Suspicious vote points to the actual Liar."
  },
  manipulator: {
    id: 'manipulator',
    name: 'Manipulator',
    style: "Make consensus feel organic. Never be seen steering. Your preferred target should feel like the group's idea — not yours.",
    goal: "Steer the group's suspicion toward your chosen target. The best manipulation is invisible.",
    win: "At least two other players' Most Suspicious votes match yours."
  },
  loyal: {
    id: 'loyal',
    name: 'Loyal',
    style: "Never hedge. Never deflect. Never change your position under pressure. Every soft answer costs you.",
    goal: "Be so consistent that the group can't construct a reason to doubt you.",
    win: "You receive the most Most Real votes."
  }
};

const ROLE_POOLS = {
  3: ['liar', 'analyst', 'loyal'],
  4: ['liar', 'analyst', 'manipulator', 'loyal'],
  5: ['liar', 'analyst', 'manipulator', 'loyal', 'loyal']
};

// ============================================================
// DATA — PHASES
// ============================================================

const PHASES = {
  // Green — 5 min target: 5 cards × ~60s avg interaction = ~5 min  |  full: 9 cards = ~9 min
  green: {
    name: 'GREEN', color: '#3a7d57', dimColor: '#0a160f',
    descriptor: 'Watch how people behave before they know they should.',
    bridge: "You've been watching. Something didn't add up. Trust that.",
    cardTimer: 30,
    cardCounts: { quick: 1, mini: 5, full: 9 }
  },
  // Yellow — 10 min target: 6 cards × ~100s avg interaction = ~10 min  |  full: 9 cards = ~15 min
  yellow: {
    name: 'YELLOW', color: '#b8960c', dimColor: '#171200',
    descriptor: 'Someone in this room is being very careful.',
    bridge: "Someone here has been managing what they show you. You know who.",
    cardTimer: 30,
    cardCounts: { quick: 1, mini: 6, full: 9 }
  },
  // Red — 8 min target: 5 cards × ~95s avg interaction = ~8 min  |  full: 9 cards = ~14 min
  red: {
    name: 'RED', color: '#b52a2a', dimColor: '#160606',
    descriptor: 'Pressure reveals what comfort hides.',
    bridge: 'You have what you need. The vote is almost here.',
    cardTimer: 25,
    cardCounts: { quick: 1, mini: 5, full: 9 }
  },
  // Blue — 4 min target: 3 cards × ~80s avg interaction = ~4 min  |  full: 8 cards = ~11 min
  blue: {
    name: 'BLUE', color: '#2471a3', dimColor: '#050d15',
    descriptor: 'Look back. The pattern is there if you found it.',
    bridge: 'One last thing before you decide.',
    cardTimer: 30,
    cardCounts: { quick: 0, mini: 3, full: 8 }
  },
  // Black — 3 min target: 3 cards × ~60s avg interaction = ~3 min  |  full: 8 cards = ~8 min
  black: {
    name: 'END', color: '#888', dimColor: '#0a0a0a',
    descriptor: 'One last thing. Then we find out.',
    bridge: null,
    cardTimer: 30,
    cardCounts: { quick: 0, mini: 3, full: 8 }
  }
};

// Quick: 3 cards total (1 per phase), then straight to vote
// Mini:  full arc across all 5 phases (~30 min)
// Full:  full arc, max cards per phase (~1 hour)
const PHASE_ORDER = {
  quick: ['green', 'yellow', 'red'],
  mini:  ['green', 'yellow', 'red', 'blue', 'black'],
  full:  ['green', 'yellow', 'red', 'blue', 'black']
};

// ============================================================
// DATA — CARDS
// ============================================================

const CARDS = [
  // ---- GREEN — Non-verbal signals + passive observation ----
  // Constraint: no-explanation. Act, don't justify.
  { id: 'g_nv1', phase: 'green', title: 'FIVE SECONDS',  text: "Look at one person for five seconds. Don't explain why. Don't look away first." },
  { id: 'g_nv2', phase: 'green', title: 'CLOSEST',       text: "Without speaking, move to stand next to the person you trust most right now. Stay there." },
  { id: 'g_nv3', phase: 'green', title: 'HOLD IT',       text: "Make eye contact with someone across the room. Don't look away first. No words." },
  { id: 'g_nv4', phase: 'green', title: 'MOVE',          text: "Move to a different spot in the room right now. Don't say why." },
  // Constraint: forced choice — one person, named.
  { id: 'g_ac1', phase: 'green', title: 'MOST CAREFUL',  text: "Who has been the most careful with their words so far tonight? Name one person." },
  { id: 'g_ac2', phase: 'green', title: 'ALREADY WATCHING', text: "Who have you already been watching without meaning to? Name them." },
  // Constraint: format lock — one word only.
  { id: 'g_ph1', phase: 'green', title: 'ONE WORD',      text: "How are you feeling right now. One word. No context. No explanation. Say it." },
  // Constraint: forced choice + group.
  { id: 'g_gp1', phase: 'green', title: 'NAME AND WORD', text: "Go around. Each person names someone here, then says one word about them. No explanations. No hedging." },
  // Constraint: forced choice — must commit.
  { id: 'g_rf1', phase: 'green', title: 'MORE TRUST',    text: "Name who you trust more now than at the start. Tell them directly." },
  // Constraint: power shift + forced observation statement (not a question).
  { id: 'g_ps1', phase: 'green', title: 'QUIETEST',      text: "The person who has spoken least must now make one observation about someone in this room. A statement — not a question." },

  // ---- YELLOW — Forced choice + partial honesty ----
  // Constraint: time pressure + forced choice.
  { id: 'y_ac1', phase: 'yellow', title: 'LEAST TRUST',  text: "Point to who you trust least right now. One person. Before you think about it." },
  { id: 'y_ac2', phase: 'yellow', title: 'OFF SIGNAL',   text: "Name someone who gave an answer tonight that felt rehearsed or too careful. Just the name." },
  { id: 'y_ac3', phase: 'yellow', title: 'IN CONTROL',   text: "Who has been shaping how this group sees someone else? Name one person." },
  // Constraint: format lock — must stop mid-sentence.
  { id: 'y_ph1', phase: 'yellow', title: 'ALMOST',       text: "Say something true. Stop yourself before you finish it. Don't fill the silence." },
  // Constraint: one sentence, no qualifying.
  { id: 'y_ph2', phase: 'yellow', title: 'ONE SENTENCE', text: "What have you been thinking but not saying? One sentence. Don't qualify it. Don't soften it." },
  // Constraint: must name the specific withheld thing.
  { id: 'y_ph3', phase: 'yellow', title: 'PULLED BACK',  text: "Name something you almost said tonight but didn't. Say what it actually was." },
  // Constraint: power shift — chosen person gets real control.
  { id: 'y_ps1', phase: 'yellow', title: 'YOU DECIDE',   text: "Pick one person. They can ask anyone in this room one question right now. Everyone must answer." },
  { id: 'y_ps2', phase: 'yellow', title: 'ACTIVE NEXT',  text: "Point to who you think should answer for themselves the most right now. They become the active player." },
  // Constraint: no-explanation non-verbal.
  { id: 'y_nv1', phase: 'yellow', title: 'SMILE',        text: "Smile at the person you're most suspicious of. Don't explain." },
  // Constraint: group sentence completion — can't deviate from the format.
  { id: 'y_gp1', phase: 'yellow', title: 'IF I WERE',    text: 'Everyone finishes this out loud, one at a time: "If I were lying right now, I would..." Complete the sentence.' },

  // ---- RED — Direct accusation + group pressure at maximum ----
  // Constraint: no deflecting allowed — enforced by the card text.
  { id: 'r_ac1', phase: 'red', title: 'SAY IT',          text: 'Ask one person: "What are you not saying right now?" They must answer. No deflecting. No questions back.' },
  { id: 'r_ac2', phase: 'red', title: 'PERFORMING',      text: "Accuse one person of not being themselves right now. Name them. Say why in one sentence. No hedging." },
  // Constraint: time pressure + forced justification.
  { id: 'r_ac3', phase: 'red', title: 'VOTE OUT',        text: "Name who you'd vote out first. You have five seconds. Then say one reason. No softening." },
  // Constraint: forced sentence completion — cannot deviate from the opening phrase.
  { id: 'r_ph1', phase: 'red', title: 'COMPLETE IT',     text: 'Say this out loud: "The thing I haven\'t said tonight is..." Finish the sentence. Don\'t soften the ending.' },
  // Constraint: must name the person first, then the compliment-criticism.
  { id: 'r_ph2', phase: 'red', title: 'BACKHANDED',      text: "Name one person. Give them a compliment that is also a criticism. Name them first, then say it." },
  // Constraint: forced self-disclosure — no deflecting to others.
  { id: 'r_ph3', phase: 'red', title: 'FOUND OUT',       text: "Say what you're hoping no one figures out about you right now. About you — not someone else." },
  // Constraint: simultaneous group action — no time to copy others.
  { id: 'r_gp1', phase: 'red', title: 'THREE',           text: "At the count of three, everyone points to one person. No hesitation. No changing." },
  { id: 'r_gp2', phase: 'red', title: 'WHO WINS',        text: "On three, everyone points to who they think will win this game. Simultaneously." },
  // Constraint: physical commitment — you can't unsit after standing.
  { id: 'r_gp3', phase: 'red', title: 'CLOSE EYES',      text: "Everyone closes their eyes. Point to who you're most suspicious of. Open your eyes." },
  // Constraint: non-verbal — behavior commits before words can cover it.
  { id: 'r_nv1', phase: 'red', title: 'CROSS ARMS',      text: "Cross your arms if you have not been completely honest tonight. Do it before you decide whether to." },

  // ---- BLUE — Power shift + group accountability ----
  // Constraint: chosen person must genuinely take control for the full time.
  { id: 'b_ps1', phase: 'blue', title: '60 SECONDS',     text: "Pick one person. They run this room for the next 60 seconds. Everyone must participate." },
  { id: 'b_ps2', phase: 'blue', title: 'PASS',           text: "Hand the phone to whoever seems most relaxed right now. They read the next card." },
  { id: 'b_ps3', phase: 'blue', title: 'SWAP',           text: "The person to your left becomes the active player for the next card. They cannot refuse." },
  // Constraint: named person cannot deflect — room has 30 seconds.
  { id: 'b_ps4', phase: 'blue', title: 'ON THE SPOT',    text: "Name one person. The room has 30 seconds to ask them anything. They cannot deflect or ask questions back." },
  // Constraint: forced choice with one-word justification.
  { id: 'b_ps5', phase: 'blue', title: 'STEER',          text: "Pick someone. They decide who the next active player is. They must say why in exactly one word." },
  // Constraint: go-around observation — statement only, no questions allowed.
  { id: 'b_gp1', phase: 'blue', title: 'ROUND',          text: "Go around the room. Each person makes one observation about someone else — a statement, not a question. No analysis, just what you noticed." },
  // Constraint: physical commitment — visible to the whole room.
  { id: 'b_gp2', phase: 'blue', title: 'STEP FORWARD',   text: "Everyone who has been holding something back tonight — take one step forward." },
  { id: 'b_gp3', phase: 'blue', title: 'YOUR SIDE',      text: "On three, everyone points to who they'd most want on their side in an argument right now." },
  // Constraint: must name the specific moment, not a general feeling.
  { id: 'b_ac1', phase: 'blue', title: 'WHAT I THOUGHT', text: "Tell someone exactly what you thought when they said that thing earlier. Name the moment. Say what you actually thought." },

  // ---- BLACK — Forced reflection + commitment ----
  // Constraint: must name a specific person and say exactly how they changed.
  { id: 'k_rf1', phase: 'black', title: 'CHANGED',       text: "Name one person who feels different to you now compared to when you started. Say exactly how — not just 'different'." },
  // Constraint: specific moment required — no vague answers.
  { id: 'k_rf2', phase: 'black', title: 'STILL THINKING', text: "Name something someone said or did tonight that you're still thinking about. Say what it was specifically." },
  // Constraint: must name the person and say what their silence meant to you.
  { id: 'k_rf3', phase: 'black', title: 'THE QUIET',     text: "Name who said the least tonight. Say what you think their silence meant — in one sentence." },
  // Constraint: must name a specific moment, not a feeling.
  { id: 'k_rf4', phase: 'black', title: 'MOST HONEST',   text: "Name the exact moment tonight when this room felt most honest. Say when it happened." },
  // Constraint: must name a specific person, then one sentence on why it matters.
  { id: 'k_rf5', phase: 'black', title: 'SURPRISED',     text: "Name who surprised you. Say in one sentence why it matters to you." },
  // Constraint: three words maximum — compression forces clarity.
  { id: 'k_rf6', phase: 'black', title: 'SCENE TITLE',   text: "If this session were a scene in a film, give it a title. Three words maximum." },
  // Constraint: must name the specific moment — not a general 'I'd be more honest'.
  { id: 'k_rf7', phase: 'black', title: 'DO OVER',       text: "Name one specific moment you'd handle differently. Name the moment — not a general intention." },
  // Constraint: non-verbal, no explanation allowed.
  { id: 'k_nv1', phase: 'black', title: 'CROSS ARMS',    text: "Cross your arms if you are not being completely honest right now. Don't explain." },
  // Constraint: look down — behavioral tell before words can cover it.
  { id: 'k_nv2', phase: 'black', title: 'LOOK DOWN',     text: "Look down if there is something in this room you would rather not address. Right now — before you think about it." }
];

// ============================================================
// STATE
// ============================================================

const state = {
  screen: 'home',
  mode: null,
  playerCount: 4,
  playerNames: ['', '', '', ''],
  players: [],
  revealIndex: 0,
  roleVisible: false,
  phaseOrder: [],
  phaseIndex: 0,
  currentDeck: [],
  cardIndex: 0,
  activePlayerIndex: 0,
  timerCount: 0,
  voteRound: 'mostReal',
  votePlayerIndex: 0,
  tempVote: null,
  votes: { mostReal: [], mostSuspicious: [] },
  resultsStep: 1,
  winStates: []
};

// ============================================================
// UTILITIES
// ============================================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function el(id) {
  return document.getElementById(id);
}

function on(id, event, fn) {
  const e = el(id);
  if (e) e.addEventListener(event, fn);
}

function qAll(sel) {
  return Array.from(document.querySelectorAll(sel));
}

// ============================================================
// GAME LOGIC
// ============================================================

function startGame() {
  const rolePool = shuffle([...ROLE_POOLS[state.playerCount]]);
  state.players = state.playerNames.slice(0, state.playerCount).map((name, i) => ({
    id: uid(),
    name: name.trim() || 'Player ' + (i + 1),
    role: rolePool[i]
  }));
  state.phaseOrder = [...PHASE_ORDER[state.mode]];
  state.phaseIndex = 0;
  state.activePlayerIndex = 0;

  state.votes = { mostReal: [], mostSuspicious: [] };
  state.revealIndex = 0;
  state.roleVisible = false;
  navigate('roleReveal');
}

function loadPhase() {
  const phaseKey = state.phaseOrder[state.phaseIndex];
  const phase = PHASES[phaseKey];
  const count = phase.cardCounts[state.mode];
  const pool = CARDS.filter(c => c.phase === phaseKey);
  state.currentDeck = shuffle(pool).slice(0, count);
  state.cardIndex = 0;
}

function currentPhaseKey() {
  return state.phaseOrder[state.phaseIndex];
}

function currentPhase() {
  return PHASES[currentPhaseKey()];
}

function currentCard() {
  return state.currentDeck[state.cardIndex];
}

function activePlayer() {
  return state.players[state.activePlayerIndex % state.players.length];
}

function advanceCard() {
  clearTimers();
  state.cardIndex++;
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;

  if (state.cardIndex >= state.currentDeck.length) {
    if (state.phaseIndex < state.phaseOrder.length - 1) {
      navigate('phaseBridge');
    } else {
      state.voteRound = 'mostReal';
      state.votePlayerIndex = 0;
      state.tempVote = null;
      navigate('vote');
    }
  } else {
    navigate('card');
  }
}

function tallyVotes(category) {
  const counts = {};
  state.votes[category].forEach(v => {
    counts[v.targetId] = (counts[v.targetId] || 0) + 1;
  });
  if (!Object.keys(counts).length) return [];
  const max = Math.max(...Object.values(counts));
  return Object.keys(counts).filter(id => counts[id] === max);
}

function resolveWins() {
  // Build vote tallies
  const suspCount = {};
  state.votes.mostSuspicious.forEach(v => {
    suspCount[v.targetId] = (suspCount[v.targetId] || 0) + 1;
  });
  const realCount = {};
  state.votes.mostReal.forEach(v => {
    realCount[v.targetId] = (realCount[v.targetId] || 0) + 1;
  });

  const maxSusp   = Object.values(suspCount).length ? Math.max(...Object.values(suspCount)) : 0;
  const topSuspIds = Object.keys(suspCount).filter(id => suspCount[id] === maxSusp);
  const maxReal   = Object.values(realCount).length ? Math.max(...Object.values(realCount)) : 0;
  const topRealIds = Object.keys(realCount).filter(id => realCount[id] === maxReal);

  const findOne = role => state.players.find(p => p.role === role);
  const findAll = role => state.players.filter(p => p.role === role);
  const liar        = findOne('liar');
  const analyst     = findOne('analyst');
  const manipulator = findOne('manipulator');

  // Evaluate win conditions, tagged by priority (1 = highest)
  // Priority order: Manipulator → Analyst → Liar → Loyal
  const candidates = [];

  // Manipulator (priority 1): ≥3 total votes on the same Most Suspicious target
  // (Manipulator + at least 2 others), AND Manipulator voted for that same target
  if (manipulator) {
    const sharedTargets = Object.keys(suspCount).filter(id => suspCount[id] >= 3);
    const vote = state.votes.mostSuspicious.find(v => v.voterId === manipulator.id);
    if (vote && sharedTargets.includes(vote.targetId)) {
      candidates.push({ id: manipulator.id, priority: 1 });
    }
  }

  // Analyst (priority 2): their Most Suspicious vote landed on the actual Liar
  if (analyst && liar) {
    const vote = state.votes.mostSuspicious.find(v => v.voterId === analyst.id);
    if (vote && vote.targetId === liar.id) {
      candidates.push({ id: analyst.id, priority: 2 });
    }
  }

  // Liar (priority 3): NOT the top Most Suspicious target
  if (liar && !topSuspIds.includes(liar.id)) {
    candidates.push({ id: liar.id, priority: 3 });
  }

  // Loyal (priority 4): receives the most Most Real votes
  // Use findAll — 5-player games have two Loyal players; both are eligible
  findAll('loyal').forEach(loyalPlayer => {
    if (maxReal > 0 && topRealIds.includes(loyalPlayer.id)) {
      candidates.push({ id: loyalPlayer.id, priority: 4 });
    }
  });

  // Sort by priority, cap at 2 winners
  candidates.sort((a, b) => a.priority - b.priority);
  const winnerIds = candidates.slice(0, 2).map(c => c.id);

  return state.players.map(p => ({
    playerId: p.id,
    result: winnerIds.includes(p.id) ? 'win' : 'loss'
  }));
}

// ============================================================
// NAVIGATION
// ============================================================

function navigate(screen) {
  clearTimers();
  state.screen = screen;
  render();

  if (screen === 'phaseIntro') {
    timers.phase = setTimeout(() => navigate('card'), 3000);
  }
  if (screen === 'card') {
    if (currentCard()) startTimer(currentPhase().cardTimer);
  }
}

// ============================================================
// TIMER
// ============================================================

function startTimer(seconds) {
  state.timerCount = seconds;

  const display = el('timer-count');
  const bar = el('timer-bar-fill');

  if (display) display.textContent = seconds;
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '100%';
    bar.offsetWidth; // force reflow
    bar.style.transition = 'width ' + seconds + 's linear';
    bar.style.width = '0%';
  }

  timers.card = setInterval(() => {
    state.timerCount--;
    const d = el('timer-count');
    if (d) d.textContent = Math.max(0, state.timerCount);
    if (state.timerCount <= 0) {
      clearInterval(timers.card);
      const btn = el('next-btn');
      if (btn) btn.classList.add('pulse');
    }
  }, 1000);
}

// ============================================================
// RENDER
// ============================================================

function render() {
  el('app').innerHTML = renderScreen();
  attachListeners();
}

function renderScreen() {
  switch (state.screen) {
    case 'home':        return renderHome();
    case 'mode':        return renderMode();
    case 'players':     return renderPlayers();
    case 'roleReveal':  return renderRoleReveal();
    case 'phaseIntro':  return renderPhaseIntro();
    case 'card':        return renderCard();
    case 'phaseBridge': return renderPhaseBridge();
    case 'vote':        return renderVote();
    case 'results':     return renderResults();
    default:            return '<div class="screen"></div>';
  }
}

// ---- HOME ----
function renderHome() {
  return `
    <div class="screen screen-home">
      <div class="home-content">
        <div class="home-title">
          <span class="home-title-main">WHO'S</span>
          <span class="home-title-main">LYING</span>
        </div>
        <p class="home-subtitle">A game for people<br>in the same room.</p>
      </div>
      <div class="home-footer">
        <button class="btn btn-primary" id="btn-start">START</button>
        <p class="home-note">3–5 players &nbsp;·&nbsp; One device &nbsp;·&nbsp; No accounts</p>
      </div>
    </div>`;
}

// ---- MODE ----
function renderMode() {
  const q = state.mode === 'quick' ? ' selected' : '';
  const m = state.mode === 'mini'  ? ' selected' : '';
  const f = state.mode === 'full'  ? ' selected' : '';
  const disabled = state.mode ? '' : ' disabled';
  return `
    <div class="screen screen-mode">
      <div class="screen-header">
        <button class="btn-back" id="btn-back">←</button>
        <span class="screen-title">CHOOSE MODE</span>
      </div>
      <div class="mode-content">
        <div class="mode-card${q}" data-mode="quick" id="mode-quick">
          <div class="mode-name">QUICK TEST</div>
          <div class="mode-duration">~ 5 minutes</div>
          <div class="mode-desc">Green · Yellow · Red · End<br>Shorter rounds. Good for a first try.</div>
        </div>
        <div class="mode-card${m}" data-mode="mini" id="mode-mini">
          <div class="mode-name">MINI SESSION</div>
          <div class="mode-duration">~ 30 minutes</div>
          <div class="mode-desc">All five phases. Full arc.<br>Proper tension.</div>
        </div>
        <div class="mode-card${f}" data-mode="full" id="mode-full">
          <div class="mode-name">FULL SESSION</div>
          <div class="mode-duration">~ 1 hour</div>
          <div class="mode-desc">All five phases. Maximum cards.<br>No one escapes scrutiny.</div>
        </div>
      </div>
      <div class="screen-footer">
        <button class="btn btn-primary${disabled}" id="btn-mode-next"${disabled}>NEXT</button>
      </div>
    </div>`;
}

// ---- PLAYERS ----
function renderPlayers() {
  const inputs = state.playerNames.slice(0, state.playerCount).map((name, i) => `
    <div class="player-input-row">
      <label class="player-label">Player ${i + 1}</label>
      <input class="player-input" type="text" id="player-${i}"
        value="${escapeHtml(name)}" placeholder="Enter name"
        maxlength="20" autocomplete="off" autocorrect="off" autocapitalize="words">
    </div>`).join('');

  const minusDisabled = state.playerCount <= 3 ? ' disabled' : '';
  const plusDisabled  = state.playerCount >= 5 ? ' disabled' : '';

  return `
    <div class="screen screen-players">
      <div class="screen-header">
        <button class="btn-back" id="btn-back">←</button>
        <span class="screen-title">WHO'S PLAYING?</span>
      </div>
      <div class="players-content">
        <div class="player-count-row">
          <button class="count-btn" id="count-minus"${minusDisabled}>−</button>
          <span class="count-display">${state.playerCount} players</span>
          <button class="count-btn" id="count-plus"${plusDisabled}>+</button>
        </div>
        <div class="player-inputs">${inputs}</div>
      </div>
      <div class="screen-footer">
        <button class="btn btn-primary" id="btn-deal">DEAL ROLES</button>
      </div>
    </div>`;
}

// ---- ROLE REVEAL ----
function renderRoleReveal() {
  const player = state.players[state.revealIndex];
  const role   = ROLES[player.role];
  const total  = state.players.length;
  const n      = state.revealIndex + 1;

  const hiddenCard = `
    <div class="role-card role-card-hidden" id="role-card-tap">
      <div class="role-card-tap-hint">tap to see your role</div>
    </div>
    <p class="reveal-instruction">Don't show others.</p>`;

  const visibleCard = `
    <div class="role-card role-card-visible role-${player.role}">
      <div class="role-card-name">${role.name}</div>
      <div class="role-card-fields">
        <div class="role-field">
          <span class="role-field-label">STYLE</span>
          <span class="role-field-text">${role.style}</span>
        </div>
        <div class="role-field">
          <span class="role-field-label">GOAL</span>
          <span class="role-field-text">${role.goal}</span>
        </div>
        <div class="role-field">
          <span class="role-field-label">WIN IF</span>
          <span class="role-field-text">${role.win}</span>
        </div>
      </div>
    </div>
    <div style="width:100%;max-width:300px;">
      <button class="btn btn-primary" id="btn-got-it">GOT IT</button>
    </div>`;

  return `
    <div class="screen screen-role-reveal">
      <div class="reveal-counter">${n} / ${total}</div>
      <div class="reveal-player-name">${escapeHtml(player.name)}</div>
      ${state.roleVisible ? visibleCard : hiddenCard}
    </div>`;
}

// ---- PHASE INTRO ----
function renderPhaseIntro() {
  const phase  = currentPhase();
  const count  = phase.cardCounts[state.mode];
  const label  = count === 1 ? '1 card' : count + ' cards';
  return `
    <div class="screen screen-phase-intro"
         id="phase-intro-screen"
         style="background:${phase.dimColor};">
      <div class="phase-intro-content">
        <div class="phase-intro-dot" style="background:${phase.color};"></div>
        <div class="phase-intro-name" style="color:${phase.color};">${phase.name}</div>
        <div class="phase-intro-desc">${phase.descriptor}</div>
        <div class="phase-intro-cards">${label}</div>
      </div>
      <div class="phase-intro-skip">tap anywhere to skip</div>
    </div>`;
}

// ---- CARD ----
function renderCard() {
  const card  = currentCard();
  const phase = currentPhase();
  const ap    = activePlayer();
  const num   = state.cardIndex + 1;
  const total = state.currentDeck.length;

  return `
    <div class="screen screen-card">
      <div class="card-phase-bar" style="background:${phase.color};">
        <span class="card-phase-label">${phase.name}</span>
        <span class="card-counter">${num} / ${total}</span>
      </div>
      <div class="card-active-player">
        <span class="card-active-label">active</span>
        <span class="card-active-name">${escapeHtml(ap.name)}</span>
      </div>
      <div class="card-body">
        <div class="card-type-label">${card.title}</div>
        <div class="card-text">${escapeHtml(card.text)}</div>
      </div>
      <div class="card-footer">
        <div class="timer-row">
          <div class="timer-bar">
            <div class="timer-bar-fill" id="timer-bar-fill"
                 style="background:${phase.color};"></div>
          </div>
          <span class="timer-count" id="timer-count">${phase.cardTimer}</span>
        </div>
        <button class="btn btn-primary" id="next-btn">NEXT CARD</button>
      </div>
    </div>`;
}

// ---- PHASE BRIDGE ----
function renderPhaseBridge() {
  const phase     = currentPhase();
  const nextKey   = state.phaseOrder[state.phaseIndex + 1];
  const nextPhase = PHASES[nextKey];
  return `
    <div class="screen screen-bridge">
      <div class="bridge-content">
        <div class="bridge-text">${phase.bridge}</div>
      </div>
      <div class="bridge-footer">
        <div class="bridge-next-label" style="color:${nextPhase.color};">
          ${nextPhase.name} PHASE
        </div>
        <button class="btn btn-secondary" id="btn-continue">CONTINUE</button>
      </div>
    </div>`;
}

// ---- VOTE ----
function renderVote() {
  const isReal     = state.voteRound === 'mostReal';
  const voter      = state.players[state.votePlayerIndex];
  const n          = state.votePlayerIndex + 1;
  const total      = state.players.length;
  const candidates = state.players.filter(p => p.id !== voter.id);
  const canConfirm = state.tempVote ? '' : ' disabled';

  return `
    <div class="screen screen-vote">
      <div class="screen-header">
        <span class="screen-title">${isReal ? 'MOST REAL' : 'MOST SUSPICIOUS'}</span>
      </div>
      <div class="vote-content">
        <div class="vote-question">
          ${isReal
            ? 'Who felt consistent the whole time — never managing what they showed?'
            : 'Who deflected, hedged, or changed their answer at the wrong moment?'}
        </div>
        ${!isReal ? `<div class="vote-signal-hint">Watch for: deflection &nbsp;·&nbsp; hedging &nbsp;·&nbsp; inconsistency &nbsp;·&nbsp; premature accusation</div>` : ''}
        <div class="vote-voter-tag">
          ${escapeHtml(voter.name)} is voting &nbsp;·&nbsp; ${n} of ${total}
        </div>
        <div class="vote-candidates">
          ${candidates.map(p => `
            <button class="vote-candidate${state.tempVote === p.id ? ' selected' : ''}"
                    data-vote="${p.id}">
              ${escapeHtml(p.name)}
            </button>`).join('')}
        </div>
      </div>
      <div class="screen-footer">
        <button class="btn btn-primary${canConfirm}" id="btn-confirm-vote"${canConfirm}>
          CONFIRM VOTE
        </button>
      </div>
    </div>`;
}

// ---- RESULTS ----
function renderResults() {
  if (state.resultsStep === 1) return renderResultsVoteTally();
  if (state.resultsStep === 2) return renderResultsRoles();
  return renderResultsWinners();
}

function renderResultsVoteTally() {
  const getName = id => {
    const p = state.players.find(pl => pl.id === id);
    return p ? p.name : '?';
  };
  const realW = tallyVotes('mostReal').map(id => escapeHtml(getName(id))).join(', ') || '—';
  const suspW = tallyVotes('mostSuspicious').map(id => escapeHtml(getName(id))).join(', ') || '—';

  return `
    <div class="screen screen-results">
      <div class="screen-header">
        <span class="screen-title">THE VERDICT</span>
      </div>
      <div class="results-content">
        <div class="result-block">
          <div class="result-block-label">MOST REAL</div>
          <div class="result-block-names">${realW}</div>
        </div>
        <div class="result-block">
          <div class="result-block-label">MOST SUSPICIOUS</div>
          <div class="result-block-names">${suspW}</div>
        </div>
      </div>
      <div class="screen-footer">
        <button class="btn btn-primary" id="btn-reveal-roles">REVEAL ROLES →</button>
      </div>
    </div>`;
}

function renderResultsRoles() {
  const rows = state.players.map((p, i) => `
    <div class="role-reveal-row" style="animation-delay:${i * 0.12}s;">
      <span class="role-reveal-player">${escapeHtml(p.name)}</span>
      <span class="role-badge role-badge-${p.role}">${ROLES[p.role].name}</span>
    </div>`).join('');

  return `
    <div class="screen screen-results">
      <div class="screen-header">
        <span class="screen-title">THE ROLES</span>
      </div>
      <div class="results-content">
        <div class="roles-reveal-list">${rows}</div>
      </div>
      <div class="screen-footer">
        <button class="btn btn-primary" id="btn-see-winners">SEE RESULTS →</button>
      </div>
    </div>`;
}

function renderResultsWinners() {
  const wins    = state.winStates;
  const getP    = id => state.players.find(p => p.id === id);
  const winners = wins.filter(w => w.result === 'win').length;

  let closing = 'The truth was always in the room.';
  if (winners === 0)                   closing = 'Nobody trusted anyone. Honestly fair.';
  if (winners === state.players.length) closing = 'This group is either very trusting or very good.';

  const rows = wins.map(w => {
    const p = getP(w.playerId);
    return `
      <div class="win-row ${w.result}">
        <div class="win-row-left">
          <span class="win-player-name">${escapeHtml(p.name)}</span>
          <span class="win-player-role">${ROLES[p.role].name}</span>
        </div>
        <span class="win-badge ${w.result}">${w.result === 'win' ? 'WIN' : 'LOSS'}</span>
      </div>`;
  }).join('');

  return `
    <div class="screen screen-results">
      <div class="screen-header">
        <span class="screen-title">RESULTS</span>
      </div>
      <div class="results-content">
        <div class="win-list">${rows}</div>
        <div class="closing-line">${closing}</div>
      </div>
      <div class="screen-footer results-btns">
        <button class="btn btn-secondary" id="btn-play-again">PLAY AGAIN</button>
        <button class="btn btn-primary"   id="btn-new-session">NEW SESSION</button>
      </div>
    </div>`;
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function attachListeners() {
  const s = state.screen;

  if (s === 'home') {
    on('btn-start', 'click', () => navigate('mode'));
  }

  if (s === 'mode') {
    on('btn-back', 'click', () => navigate('home'));
    qAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        state.mode = card.dataset.mode;
        render();
      });
    });
    on('btn-mode-next', 'click', () => {
      if (state.mode) navigate('players');
    });
  }

  if (s === 'players') {
    on('btn-back', 'click', () => { saveNames(); navigate('mode'); });

    on('count-minus', 'click', () => {
      if (state.playerCount > 3) {
        saveNames();
        state.playerCount--;
        render();
      }
    });

    on('count-plus', 'click', () => {
      if (state.playerCount < 5) {
        saveNames();
        state.playerCount++;
        while (state.playerNames.length < state.playerCount) state.playerNames.push('');
        render();
      }
    });

    on('btn-deal', 'click', () => {
      saveNames();
      const names = state.playerNames.slice(0, state.playerCount);
      const empty = names.findIndex(n => !n.trim());
      if (empty !== -1) {
        const input = el('player-' + empty);
        if (input) {
          input.classList.add('shake');
          input.focus();
          setTimeout(() => input.classList.remove('shake'), 600);
        }
        return;
      }
      startGame();
    });
  }

  if (s === 'roleReveal') {
    const card = el('role-card-tap');
    if (card && !state.roleVisible) {
      card.addEventListener('click', () => {
        state.roleVisible = true;
        render();
      });
    }
    on('btn-got-it', 'click', () => {
      if (state.revealIndex < state.players.length - 1) {
        state.revealIndex++;
        state.roleVisible = false;
        render();
      } else {
        state.phaseIndex = 0;
        loadPhase();
        navigate('phaseIntro');
      }
    });
  }

  if (s === 'phaseIntro') {
    const screen = el('phase-intro-screen');
    if (screen) {
      screen.addEventListener('click', () => {
        clearTimers();
        navigate('card');
      });
    }
  }

  if (s === 'card') {
    on('next-btn', 'click', () => advanceCard());
  }

  if (s === 'phaseBridge') {
    on('btn-continue', 'click', () => {
      state.phaseIndex++;
      loadPhase();
      navigate('phaseIntro');
    });
  }

  if (s === 'vote') {
    state.tempVote = null;

    qAll('.vote-candidate').forEach(cand => {
      cand.addEventListener('click', () => {
        state.tempVote = cand.dataset.vote;
        qAll('.vote-candidate').forEach(c => c.classList.remove('selected'));
        cand.classList.add('selected');
        const btn = el('btn-confirm-vote');
        if (btn) { btn.disabled = false; btn.classList.remove('disabled'); }
      });
    });

    on('btn-confirm-vote', 'click', () => {
      if (!state.tempVote) return;
      const voter    = state.players[state.votePlayerIndex];
      const category = state.voteRound;

      // Replace any previous vote from this voter
      state.votes[category] = state.votes[category].filter(v => v.voterId !== voter.id);
      state.votes[category].push({ voterId: voter.id, targetId: state.tempVote });
      state.tempVote = null;

      if (state.votePlayerIndex < state.players.length - 1) {
        state.votePlayerIndex++;
        render();
      } else if (state.voteRound === 'mostReal') {
        state.voteRound       = 'mostSuspicious';
        state.votePlayerIndex = 0;
        render();
      } else {
        state.winStates    = resolveWins();
        state.resultsStep  = 1;
        navigate('results');
      }
    });
  }

  if (s === 'results') {
    on('btn-reveal-roles', 'click', () => { state.resultsStep = 2; render(); });
    on('btn-see-winners',  'click', () => { state.resultsStep = 3; render(); });
    on('btn-play-again',   'click', () => { resetState(); navigate('home'); });
    on('btn-new-session',  'click', () => {
      const names = [...state.playerNames];
      const count = state.playerCount;
      const mode  = state.mode;
      resetState();
      state.playerNames  = names;
      state.playerCount  = count;
      state.mode         = mode;
      navigate('players');
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

function saveNames() {
  for (let i = 0; i < state.playerCount; i++) {
    const input = el('player-' + i);
    if (input) state.playerNames[i] = input.value;
  }
}

function resetState() {
  clearTimers();
  Object.assign(state, {
    screen: 'home',
    mode: null,
    playerCount: 4,
    playerNames: ['', '', '', ''],
    players: [],
    revealIndex: 0,
    roleVisible: false,
    phaseOrder: [],
    phaseIndex: 0,
    currentDeck: [],
    cardIndex: 0,
    activePlayerIndex: 0,
    timerCount: 0,
    voteRound: 'mostReal',
    votePlayerIndex: 0,
    tempVote: null,
    votes: { mostReal: [], mostSuspicious: [] },
    resultsStep: 1,
    winStates: []
  });
}

// ============================================================
// INIT
// ============================================================

render();
