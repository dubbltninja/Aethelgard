const els = {
  shell: document.querySelector(".app-shell"),
  modeLine: document.getElementById("modeLine"),
  restartButton: document.getElementById("restartButton"),
  promptBanner: document.getElementById("promptBanner"),
  actionBar: document.getElementById("actionBar"),
  screenOutput: document.getElementById("screenOutput"),
  transcript: document.getElementById("transcript"),
  commandForm: document.getElementById("commandForm"),
  commandInput: document.getElementById("commandInput"),
  characterCard: document.getElementById("characterCard"),
  locationCard: document.getElementById("locationCard"),
  combatPanel: document.getElementById("combatPanel"),
  combatCard: document.getElementById("combatCard"),
  inventoryList: document.getElementById("inventoryList"),
  questList: document.getElementById("questList"),
  mapSvg: document.getElementById("mapSvg"),
  saveSlots: document.getElementById("saveSlots"),
  scoreList: document.getElementById("scoreList"),
  breachCanvas: document.getElementById("breachCanvas"),
};

let currentState = null;
let polling = null;

function pct(value, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100));
}

function text(value) {
  return value == null || value === "" ? "-" : String(value);
}

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}

function makeButton(label, value, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (options.danger) button.classList.add("danger");
  if (options.ghost) button.classList.add("ghost");
  if (options.disabled) button.disabled = true;
  button.addEventListener("click", () => submitInput(value));
  return button;
}

function commandReady(state) {
  return Boolean(state && state.waiting_for_input && state.prompt === ">");
}

async function fetchState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw new Error(`State request failed: ${response.status}`);
  return response.json();
}

async function submitInput(value) {
  els.commandInput.value = "";
  const response = await fetch("/api/input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: value }),
  });
  if (!response.ok) throw new Error(`Input request failed: ${response.status}`);
  render(await response.json());
}

async function restartSession() {
  const response = await fetch("/api/restart", { method: "POST" });
  if (!response.ok) throw new Error(`Restart failed: ${response.status}`);
  render(await response.json());
}

function render(state) {
  currentState = state;
  document.body.classList.toggle("horde", Boolean(state.horde && state.horde.active));
  document.body.classList.toggle("combat", Boolean(state.combat_enemy));
  els.shell.dataset.state = state.mode || "unknown";
  renderTopline(state);
  renderPrompt(state);
  renderActions(state);
  renderOutput(state);
  renderCharacter(state);
  renderLocation(state);
  renderCombat(state);
  renderInventory(state);
  renderQuests(state);
  renderMap(state);
  renderSlots(state);
  renderScores(state);
}

function renderTopline(state) {
  if (state.error) {
    els.modeLine.textContent = state.error;
    return;
  }
  if (!state.player) {
    els.modeLine.textContent = state.finished ? "Session closed" : "Launch menu";
    return;
  }
  const player = state.player;
  const loc = state.location ? state.location.name : player.current_location;
  els.modeLine.textContent = `${player.name} | ${player.class_name} | Level ${player.level} | ${loc}`;
}

function renderPrompt(state) {
  const prompt = state.prompt || "";
  els.promptBanner.classList.toggle("active", Boolean(prompt));
  els.promptBanner.textContent = prompt;
}

function renderActions(state) {
  els.actionBar.innerHTML = "";
  const groups = new Map();
  for (const action of state.actions || []) {
    if (!groups.has(action.category)) groups.set(action.category, []);
    groups.get(action.category).push(action);
  }
  for (const actions of groups.values()) {
    for (const action of actions) {
      els.actionBar.appendChild(makeButton(action.label, action.value, { danger: action.danger }));
    }
  }
}

function renderOutput(state) {
  const screenText = (state.screen || []).map((line) => line.text).join("\n");
  els.screenOutput.textContent = screenText || "";
  const nearBottom = els.transcript.scrollTop + els.transcript.clientHeight >= els.transcript.scrollHeight - 24;
  els.transcript.innerHTML = "";
  for (const line of (state.transcript || []).slice(-160)) {
    const row = el("div", `line ${line.kind || "output"}`);
    row.textContent = line.text || " ";
    if (/damage|danger|fallen|game over|no time|horde|unravel/i.test(line.text || "")) {
      row.classList.add("danger-text");
    }
    els.transcript.appendChild(row);
  }
  if (nearBottom) els.transcript.scrollTop = els.transcript.scrollHeight;
}

function renderCharacter(state) {
  const player = state.player;
  if (!player) {
    els.characterCard.innerHTML = `<div class="empty">No active Wayfinder.</div>`;
    return;
  }
  const weapon = state.equipment && state.equipment.weapon ? state.equipment.weapon.name : "None";
  const armor = state.equipment && state.equipment.armor ? state.equipment.armor.name : "None";
  els.characterCard.innerHTML = "";
  const grid = el("div", "stat-grid");
  grid.appendChild(statBlock("HP", `${Math.round(player.health)}/${Math.round(player.max_health)}`, pct(player.health, player.max_health), "hp"));
  grid.appendChild(statBlock("MP", `${Math.round(player.mana)}/${Math.round(player.max_mana)}`, pct(player.mana, player.max_mana), "mp"));
  grid.appendChild(statBlock("Level", `${player.level} (${player.experience}/${player.experience_required})`, pct(player.experience, player.experience_required)));
  grid.appendChild(statBlock("Gold", player.gold));
  grid.appendChild(statBlock("Strength", player.strength));
  grid.appendChild(statBlock("Magic", player.magic));
  grid.appendChild(statBlock("Agility", player.agility));
  grid.appendChild(statBlock("Spell", titleCase(player.current_spell)));
  grid.appendChild(statBlock("Weapon", weapon));
  grid.appendChild(statBlock("Armor", armor));
  els.characterCard.appendChild(grid);
}

function statBlock(label, value, meterPct, meterClass = "") {
  const wrap = el("div", "stat");
  wrap.appendChild(el("label", "", label));
  wrap.appendChild(el("strong", "", value));
  if (meterPct != null) {
    const meter = el("div", `meter ${meterClass}`);
    const fill = document.createElement("span");
    fill.style.width = `${meterPct}%`;
    meter.appendChild(fill);
    wrap.appendChild(meter);
  }
  return wrap;
}

function renderLocation(state) {
  const loc = state.location;
  if (!loc) {
    els.locationCard.innerHTML = `<div class="empty">Use the menu to begin.</div>`;
    return;
  }
  els.locationCard.innerHTML = "";
  const list = el("div", "card-list");
  const card = el("div", "mini-card");
  card.appendChild(el("h3", "", loc.name));
  card.appendChild(el("p", "", loc.description));
  const tags = el("div", "");
  for (const exit of loc.exits || []) {
    const tag = el("span", `tag ${exit.locked ? "" : "good"}`, `${exit.direction}: ${exit.locked ? "locked" : exit.destination}`);
    tags.appendChild(tag);
  }
  card.appendChild(tags);
  const actions = el("div", "mini-actions");
  if (commandReady(state)) {
    for (const exit of loc.exits || []) {
      actions.appendChild(makeButton(exit.direction, exit.command, { disabled: exit.locked }));
    }
  }
  card.appendChild(actions);
  list.appendChild(card);

  if ((loc.npcs || []).length) {
    for (const npc of loc.npcs) {
      const npcCard = el("div", "mini-card");
      npcCard.appendChild(el("h3", "", npc.name));
      npcCard.appendChild(el("p", "", `${npc.faction}: ${npc.description}`));
      const actions = el("div", "mini-actions");
      actions.appendChild(makeButton("Talk", `talk ${npc.name}`, { disabled: !commandReady(state) }));
      npcCard.appendChild(actions);
      list.appendChild(npcCard);
    }
  }
  els.locationCard.appendChild(list);
}

function renderCombat(state) {
  const enemy = state.combat_enemy;
  els.combatPanel.style.display = enemy ? "" : "none";
  if (!enemy) {
    els.combatCard.innerHTML = "";
    return;
  }
  els.combatCard.innerHTML = "";
  const grid = el("div", "stat-grid");
  grid.appendChild(statBlock("Enemy", `${enemy.name} Lv ${enemy.level}`));
  grid.appendChild(statBlock("HP", `${Math.round(enemy.health)}/${Math.round(enemy.max_health)}`, pct(enemy.health, enemy.max_health), "hp"));
  grid.appendChild(statBlock("Damage", enemy.damage));
  grid.appendChild(statBlock("Defense", enemy.defense));
  els.combatCard.appendChild(grid);
}

function renderInventory(state) {
  const inventory = state.inventory || [];
  if (!inventory.length) {
    els.inventoryList.innerHTML = `<div class="empty">Inventory is empty.</div>`;
    return;
  }
  els.inventoryList.innerHTML = "";
  const list = el("div", "card-list");
  for (const item of inventory) {
    const card = el("div", "mini-card");
    const name = item.rarity ? `[${item.rarity}] ${item.name}` : item.name;
    card.appendChild(el("h3", "", name));
    card.appendChild(el("p", "", item.description));
    const tags = el("div", "");
    tags.appendChild(el("span", "tag", item.type));
    if (item.equipped_weapon) tags.appendChild(el("span", "tag good", "weapon"));
    if (item.equipped_armor) tags.appendChild(el("span", "tag good", "armor"));
    if (item.gold_value) tags.appendChild(el("span", "tag gold", `${item.gold_value} gold`));
    card.appendChild(tags);
    const actions = el("div", "mini-actions");
    const ready = commandReady(state);
    actions.appendChild(makeButton("Examine", `examine ${item.command_name}`, { disabled: !ready }));
    if (item.type === "weapon" || item.type === "armor") {
      actions.appendChild(makeButton("Equip", `equip ${item.command_name}`, { disabled: !ready }));
    }
    if (item.type === "consumable") {
      actions.appendChild(makeButton("Use", `use ${item.command_name}`, { disabled: !ready }));
    }
    actions.appendChild(makeButton("Drop", `drop ${item.command_name}`, { danger: true, disabled: !ready }));
    card.appendChild(actions);
    list.appendChild(card);
  }
  els.inventoryList.appendChild(list);
}

function renderQuests(state) {
  const quests = state.quests || [];
  if (!quests.length) {
    els.questList.innerHTML = `<div class="empty">No quests recorded.</div>`;
    return;
  }
  els.questList.innerHTML = "";
  const list = el("div", "card-list");
  for (const quest of quests) {
    const card = el("div", "mini-card");
    card.appendChild(el("h3", "", quest.name));
    card.appendChild(el("p", "", quest.description));
    card.appendChild(el("span", `tag ${quest.status === "completed" ? "good" : "gold"}`, quest.status));
    list.appendChild(card);
  }
  els.questList.appendChild(list);
}

function renderMap(state) {
  const map = state.map || { nodes: [], edges: [] };
  els.mapSvg.innerHTML = "";
  const nodeByName = new Map(map.nodes.map((node) => [node.name, node]));
  for (const edge of map.edges || []) {
    if (!edge.visible) continue;
    const start = nodeByName.get(edge.start);
    const end = nodeByName.get(edge.end);
    if (!start || !end) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", start.x + 1.8);
    line.setAttribute("y1", start.y + 0.6);
    line.setAttribute("x2", end.x + 1.8);
    line.setAttribute("y2", end.y + 0.6);
    line.setAttribute("class", `map-edge ${edge.locked ? "locked" : ""}`);
    els.mapSvg.appendChild(line);
  }
  for (const node of map.nodes || []) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `map-node ${node.status}`);
    group.setAttribute("transform", `translate(${node.x}, ${node.y})`);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "3.6");
    rect.setAttribute("height", "1.2");
    rect.setAttribute("rx", "0.22");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "1.8");
    label.setAttribute("y", "0.66");
    label.textContent = node.visible ? node.abbr : "";
    group.appendChild(rect);
    group.appendChild(label);
    group.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "title")).textContent = node.name;
    els.mapSvg.appendChild(group);
  }
}

function renderSlots(state) {
  const slots = state.save_slots || [];
  els.saveSlots.innerHTML = "";
  for (const slot of slots) {
    const row = el("div", "slot", slot.label);
    els.saveSlots.appendChild(row);
  }
}

function renderScores(state) {
  const scores = [...(state.scores || [])].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  els.scoreList.innerHTML = "";
  if (!scores.length) return;
  for (const score of scores) {
    const row = el("div", "score-row");
    const points = el("strong", "", text(score.score));
    row.appendChild(points);
    row.appendChild(document.createTextNode(` ${text(score.player)} ${text(score.result)}`));
    els.scoreList.appendChild(row);
  }
}

function titleCase(value) {
  return text(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

els.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = els.commandInput.value;
  submitInput(value).catch(showError);
});

els.restartButton.addEventListener("click", () => {
  restartSession().catch(showError);
});

function showError(error) {
  els.modeLine.textContent = error.message;
}

function startPolling() {
  if (polling) clearInterval(polling);
  polling = setInterval(() => {
    fetchState().then(render).catch(showError);
  }, 900);
}

function animateBreach() {
  const canvas = els.breachCanvas;
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  const cracks = Array.from({ length: 38 }, (_, i) => ({
    seed: i * 47,
    x: Math.random(),
    y: Math.random(),
    len: 0.12 + Math.random() * 0.34,
    angle: Math.random() * Math.PI * 2,
    speed: 0.15 + Math.random() * 0.4,
  }));

  function resize() {
    width = canvas.width = window.innerWidth * window.devicePixelRatio;
    height = canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  }

  function frame(time) {
    ctx.clearRect(0, 0, width, height);
    const active = document.body.classList.contains("horde") || document.body.classList.contains("combat");
    ctx.lineCap = "round";
    for (const crack of cracks) {
      const phase = time * 0.0002 * crack.speed + crack.seed;
      const alpha = active ? 0.22 + Math.sin(phase) * 0.12 : 0.09 + Math.sin(phase) * 0.04;
      const x = crack.x * width;
      const y = crack.y * height;
      const len = crack.len * Math.min(width, height);
      const wobble = Math.sin(phase * 2) * 0.5;
      ctx.strokeStyle = `rgba(95, 216, 212, ${Math.max(0.02, alpha)})`;
      ctx.lineWidth = active ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(crack.angle + wobble) * len, y + Math.sin(crack.angle + wobble) * len);
      ctx.stroke();
      if (active) {
        ctx.strokeStyle = `rgba(207, 91, 85, ${Math.max(0.02, alpha * 0.55)})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(crack.angle - wobble) * len * 0.62, y + Math.sin(crack.angle - wobble) * len * 0.62);
        ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
}

fetchState().then(render).then(startPolling).catch(showError);
animateBreach();
