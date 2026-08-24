// M3 对话模块：双模式
//  - AI 模式（有 API Key）：JSON 协议（决策 D50），动态选项，历史 10 轮，失败用人物卡兜底台词
//  - 假数据模式（无 Key）：复用 DIALOGUES 节点树，同伴无 Key 也能体验
// 宽容解析：任何格式异常都不卡死
window.Dialogue = (() => {
  'use strict';

  const CHAR_MS = 24;   // 每字打字耗时 ms
  const BOX = { x: 24, y: null, w: null, h: 172 };

  const state = {
    active: false, mode: 'fake', npc: null,
    // 假数据模式
    nodeIndex: 0, endAfter: false, textQueue: [], nodeOptions: [],
    // AI 模式
    history: [], reply: '', aiOptions: [], pending: false, event: null, fallbackIdx: 0,
    // 共用打字机
    shown: '', typing: false, finished: true, elapsed: 0,
    optionRects: [], closeRect: null
  };

  const npcName = id => (window.NPC_META && window.NPC_META[id] && window.NPC_META[id].name) || id;
  const npcColor = id => (window.NPC_META && window.NPC_META[id] && window.NPC_META[id].color) || '#B98A5A';
  const curOptions = () => (state.mode === 'ai' ? state.aiOptions : state.nodeOptions);

  // ============ 假数据模式（无 API Key 时的离线玩法） ============
  function loadNode(i) {
    const data = window.DIALOGUES[state.npc][i];
    state.nodeIndex = i;
    state.endAfter = false;
    state.textQueue = [];
    state.nodeOptions = [];
    const lines = String(data).split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line === '（对话结束）') { state.endAfter = true; continue; }
      if (line.startsWith('[选项]')) state.nodeOptions.push(line.slice(4).trim());
      else state.textQueue.push(line);
    }
    state.shown = '';
    state.typing = state.textQueue.length > 0;
    state.finished = false;
    state.elapsed = 0;
  }

  // ============ AI 模式 ============
  function startAI(npcId) {
    state.active = true; state.mode = 'ai'; state.npc = npcId;
    state.history = []; state.reply = ''; state.aiOptions = []; state.pending = true;
    state.event = null; state.fallbackIdx = 0;
    state.shown = ''; state.typing = false; state.finished = false;
    nextTurn('（主角走到你面前，打了个招呼。）');
  }

  async function nextTurn(userText) {
    state.pending = true;
    state.aiOptions = []; state.event = null;
    state.shown = ''; state.typing = false; state.finished = false;
    try {
      const raw = await window.AI.chat({ npcId: state.npc, history: state.history, user: userText });
      const parsed = window.AI.parseReply(raw);
      state.history = state.history.concat([
        { role: 'user', content: userText },
        { role: 'assistant', content: raw }
      ]).slice(-10);   // 只保留最近 10 轮
      state.reply = parsed.reply || '……';
      state.aiOptions = parsed.options.length ? parsed.options : ['（继续）'];
      if (parsed.event) { state.event = parsed.event; console.log('[对话→事件] ' + parsed.event); }
    } catch (e) {
      // 兜底：人物卡兜底台词轮换（决策 D21）
      const p = window.PERSONAS && window.PERSONAS[state.npc];
      const fb = (p && p.fallback_lines) || ['……'];
      state.reply = fb[state.fallbackIdx++ % fb.length];
      state.aiOptions = ['（继续）'];
      console.warn('[AI 兜底] ' + e.message);
    }
    state.pending = false;
    state.shown = ''; state.typing = true; state.elapsed = 0;
  }

  // ============ 入口 ============
  function start(npcId) {
    if (state.active) return;
    if (!window.NPC_META || !window.NPC_META[npcId]) return;
    if (window.AI && window.AI.ready()) startAI(npcId);
    else startFake(npcId);
  }
  function startFake(npcId) {
    state.active = true; state.mode = 'fake'; state.npc = npcId;
    loadNode(0);
  }
  function close() {
    state.active = false; state.npc = null;
    state.optionRects = []; state.closeRect = null;
  }

  // ============ 更新 ============
  function update(dt) {
    if (!state.active || state.pending) return;
    if (!state.typing) return;
    state.elapsed += dt * 1000;
    const target = state.mode === 'ai' ? state.reply : (state.textQueue[0] || '');
    state.shown = target.slice(0, Math.floor(state.elapsed / CHAR_MS));
    if (state.shown.length >= target.length) { state.shown = target; state.typing = false; state.finished = true; }
  }

  // 空格/回车：打字中=跳过；否则推进
  function advance() {
    if (!state.active || state.pending) return;
    if (state.typing) {
      const target = state.mode === 'ai' ? state.reply : (state.textQueue[0] || '');
      state.shown = target; state.typing = false; state.finished = true;
      return;
    }
    if (curOptions().length) return;   // 等玩家选选项
    if (state.mode === 'fake') {
      state.textQueue.shift();
      if (state.textQueue.length) { state.shown = ''; state.elapsed = 0; state.typing = true; return; }
      if (state.endAfter) { close(); return; }
      loadNode(state.nodeIndex + 1);
    }
    // AI 模式总有选项（含「（继续）」），不会走到这里
  }

  // 选项选择：假数据=跳节点；AI=作为玩家发言发下一轮
  function select(i) {
    if (!state.active || state.pending) return;
    const opts = curOptions();
    if (i < 0 || i >= opts.length) return;
    if (state.mode === 'fake') { loadNode(i + 1); return; }
    const chosen = opts[i];
    nextTurn(chosen === '（继续）' ? '（主角继续听着。）' : chosen);
  }

  function onKey(code) {
    if (!state.active) return;
    if (code === 'Escape') { close(); return; }
    if (code === 'Space' || code === 'Enter') { advance(); return; }
    const m = code.match(/^Digit(\d)$/);
    if (m) select(parseInt(m[1], 10) - 1);
  }

  function onClick(x, y) {
    if (!state.active) return;
    if (state.closeRect && x >= state.closeRect.x && x <= state.closeRect.x + state.closeRect.w &&
        y >= state.closeRect.y && y <= state.closeRect.y + state.closeRect.h) { close(); return; }
    const opts = curOptions();
    if (!opts.length || state.pending) return;
    for (let i = 0; i < state.optionRects.length; i++) {
      const r = state.optionRects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { select(i); return; }
    }
  }

  // ============ 绘制 ============
  function wrapText(ctx, text, maxW) {
    const lines = []; let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function draw(ctx, viewW, viewH) {
    if (!state.active) return;
    BOX.y = viewH - BOX.h - 16;
    BOX.w = viewW - 48;

    // 底板
    ctx.fillStyle = 'rgba(251,246,233,0.97)';
    ctx.strokeStyle = '#4A3B32';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(BOX.x, BOX.y, BOX.w, BOX.h, 8);
    ctx.fill(); ctx.stroke();

    // 名字牌
    const name = npcName(state.npc);
    ctx.fillStyle = npcColor(state.npc);
    ctx.fillRect(BOX.x + 14, BOX.y + 12, 96, 26);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(name, BOX.x + 24, BOX.y + 30);

    // 关闭按钮（× 离开）
    state.closeRect = { x: BOX.x + BOX.w - 74, y: BOX.y + 12, w: 60, h: 26 };
    ctx.fillStyle = '#E8D9C0';
    ctx.strokeStyle = '#B98A5A';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(state.closeRect.x, state.closeRect.y, state.closeRect.w, state.closeRect.h, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4A3B32';
    ctx.font = '13px system-ui';
    ctx.fillText('× 离开', state.closeRect.x + 12, state.closeRect.y + 18);

    // 头像占位
    ctx.fillStyle = npcColor(state.npc);
    ctx.fillRect(BOX.x + 14, BOX.y + 46, 40, 56);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText(name[0], BOX.x + 30, BOX.y + 82);

    // 文本区
    const tx = BOX.x + 70, ty = BOX.y + 52, maxW = BOX.w - 94;
    ctx.fillStyle = '#4A3B32';
    ctx.font = '15px system-ui';
    if (state.pending) {
      ctx.fillText('……（思考中）', tx, ty);
    } else {
      const lines = wrapText(ctx, state.shown, maxW);
      for (let i = 0; i < lines.length && i < 4; i++) ctx.fillText(lines[i], tx, ty + i * 24);
    }

    // 选项按钮
    state.optionRects = [];
    const opts = curOptions();
    if (!state.pending && opts.length && !state.typing) {
      const oy = BOX.y + BOX.h - 16 - opts.length * 30;
      for (let i = 0; i < opts.length; i++) {
        const r = { x: tx, y: oy + i * 30, w: maxW, h: 24 };
        state.optionRects.push(r);
        ctx.fillStyle = '#F2E8D0';
        ctx.strokeStyle = '#B98A5A';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4A3B32';
        ctx.font = '14px system-ui';
        ctx.fillText((i + 1) + '. ' + opts[i], r.x + 10, r.y + 17);
      }
    }
  }

  return {
    start, update, draw, onKey, onClick,
    get active() { return state.active; },
    get npc() { return state.npc; },
    get mode() { return state.mode; }
  };
})();
