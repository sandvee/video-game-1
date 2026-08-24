// M2 对话模块：底部对话框 + 打字机 + 选项按钮 + 宽容协议解析
// 解析规则（docs/AI_PROTOCOL.md）：[选项]行=选项；[事件]/[情绪]行=预留；其他行=台词
// 宽容策略：未知内容当台词显示；无选项时给默认「（继续）」；解析失败绝不让游戏卡死
window.Dialogue = (() => {
  'use strict';

  const state = {
    active: false, npc: null, nodeIndex: 0, endAfter: false,
    textQueue: [], options: [],
    shown: '', typing: false, finished: true,
    optionRects: [], elapsed: 0
  };
  const CHAR_MS = 28;   // 每字打字耗时 ms
  const BOX = { x: 24, y: null, w: null, h: 160 };

  function npcName(id) { return (window.NPC_META && window.NPC_META[id] && window.NPC_META[id].name) || id; }
  function npcColor(id) { return (window.NPC_META && window.NPC_META[id] && window.NPC_META[id].color) || '#B98A5A'; }

  function loadNode(i) {
    const data = window.DIALOGUES[state.npc][i];
    state.nodeIndex = i;
    state.endAfter = false;
    state.textQueue = [];
    state.options = [];
    const lines = String(data).split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line === '（对话结束）') { state.endAfter = true; continue; }   // 控制行：不显示，播完即结束
      if (line.startsWith('[选项]')) state.options.push(line.slice(4).trim());
      else if (line.startsWith('[事件]')) console.log('[对话→事件] ' + line.slice(5).trim());   // M4 接事件系统
      else if (line.startsWith('[情绪]')) { /* 预留：头像/音乐反应 */ }
      else state.textQueue.push(line);
    }
    state.shown = '';
    state.typing = state.textQueue.length > 0;
    state.finished = false;
    state.elapsed = 0;
  }

  function start(npcId) {
    if (state.active) return;                     // 对话中忽略重复触发
    if (!window.DIALOGUES || !window.DIALOGUES[npcId]) return;
    state.active = true; state.npc = npcId;
    loadNode(0);
  }

  function close() { state.active = false; state.npc = null; state.optionRects = []; }

  function update(dt) {
    if (!state.active || !state.typing) return;
    state.elapsed += dt * 1000;
    const target = state.textQueue[0] || '';
    state.shown = target.slice(0, Math.floor(state.elapsed / CHAR_MS));
    if (state.shown.length >= target.length) { state.shown = target; state.typing = false; state.finished = true; }
  }

  // 空格/回车：打字中=跳过；否则推进（有选项时等玩家选）
  function advance() {
    if (!state.active) return;
    if (state.typing) { state.shown = state.textQueue[0] || ''; state.typing = false; state.finished = true; return; }
    if (state.options.length) return;
    state.textQueue.shift();
    if (state.textQueue.length) { state.shown = ''; state.elapsed = 0; state.typing = true; return; }
    if (state.endAfter) { close(); return; }
    loadNode(state.nodeIndex + 1);
  }

  function select(i) {
    if (!state.active || !state.options.length) return;
    if (i < 0 || i >= state.options.length) return;
    loadNode(i + 1);   // 假数据约定：选项 i → 节点 i+1（M3 真 AI 改为回传选项文本）
  }

  function onKey(code) {
    if (!state.active) return;
    if (code === 'Space' || code === 'Enter') { advance(); return; }
    const m = code.match(/^Digit(\d)$/);
    if (m) select(parseInt(m[1], 10) - 1);
  }

  function onClick(x, y) {
    if (!state.active || !state.options.length) return;
    for (let i = 0; i < state.optionRects.length; i++) {
      const r = state.optionRects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { select(i); return; }
    }
  }

  // ---- 绘制 ----
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

    // 头像占位（真实立绘就绪后替换）
    ctx.fillStyle = npcColor(state.npc);
    ctx.fillRect(BOX.x + 14, BOX.y + 46, 40, 56);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText(name[0], BOX.x + 30, BOX.y + 82);

    // 台词（打字机 + 自动换行）
    const tx = BOX.x + 70, ty = BOX.y + 48, maxW = BOX.w - 90;
    ctx.fillStyle = '#4A3B32';
    ctx.font = '15px system-ui';
    const lines = wrapText(ctx, state.shown, maxW);
    for (let i = 0; i < lines.length && i < 4; i++) ctx.fillText(lines[i], tx, ty + i * 24);

    // 选项（打字结束后出现，按钮式，支持点击/数字键）
    state.optionRects = [];
    if (state.options.length && !state.typing) {
      const oy = BOX.y + BOX.h - 16 - state.options.length * 30;
      for (let i = 0; i < state.options.length; i++) {
        const r = { x: tx, y: oy + i * 30, w: maxW, h: 24 };
        state.optionRects.push(r);
        ctx.fillStyle = '#F2E8D0';
        ctx.strokeStyle = '#B98A5A';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4A3B32';
        ctx.font = '14px system-ui';
        ctx.fillText((i + 1) + '. ' + state.options[i], r.x + 10, r.y + 17);
      }
    }

    // 推进指示
    if (state.finished && !state.options.length) {
      ctx.fillStyle = '#B98A5A';
      ctx.font = 'bold 14px system-ui';
      ctx.fillText('▼', BOX.x + BOX.w - 28, BOX.y + BOX.h - 14);
    }
  }

  return { start, update, draw, onKey, onClick, get active() { return state.active; }, get npc() { return state.npc; } };
})();
