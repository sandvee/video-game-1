// M1+M2 引擎：地图渲染/移动/碰撞/镜头 + 对话模块集成
// 用法：双击 index.html（数据以 .js 内嵌，不走 fetch，file:// 也能跑）
(() => {
  'use strict';
  const CFG = window.CFG;
  const TILE = CFG.TILE;

  // ---- 地图数据（Tiled JSON 子集，见 src/maps/town.map.js）----
  const MAP = window.TOWN_MAP;
  const W = MAP.width, H = MAP.height;

  // 可走 gid 表：无 collision 层时按此判定；有 collision 层时以该层为准
  const WALKABLE = { 1: true, 2: true, 8: true, 10: true };
  // 占位渲染色（配色方案 A「奶油与青草」；真实 tileset 就绪后替换）
  const TILE_COLORS = {
    1: '#A8C686', 2: '#D9C9A3', 3: '#7FB5C9', 4: '#6E9A5B', 5: '#B98A5A',
    6: '#C96F4A', 7: '#8C6B4F', 8: '#F2B8A0', 9: '#8A5A33', 10: '#C9A87C'
  };

  // ---- 解析图层 ----
  const groundLayer = MAP.layers.find(l => l.type === 'tilelayer' && l.name !== 'collision');
  const collisionLayer = MAP.layers.find(l => l.type === 'tilelayer' && l.name === 'collision');
  const eventLayer = MAP.layers.find(l => l.type === 'objectgroup');
  const ground = groundLayer.data;

  const solid = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true; // 出界=阻挡
    const idx = ty * W + tx;
    if (collisionLayer) return collisionLayer.data[idx] > 0;
    const g = ground[idx];
    return g > 0 && !WALKABLE[g];
  };

  // ---- Canvas ----
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = CFG.VIEW_W;
  canvas.height = CFG.VIEW_H;

  // 离线渲染整张地图一次，每帧只做裁剪拷贝
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = W * TILE;
  mapCanvas.height = H * TILE;
  (() => {
    const mctx = mapCanvas.getContext('2d');
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const g = ground[ty * W + tx];
        if (!g) continue;
        mctx.fillStyle = TILE_COLORS[g] || '#eee';
        mctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  })();

  // ---- 事件对象：NPC 与触发点分离 ----
  const events = (eventLayer && eventLayer.objects) || [];
  const spawn = events.find(e => e.name === 'spawn') || { x: 0, y: 0, width: 32, height: 32 };
  const npcs = events.filter(e => e.type === 'npc');
  const triggers = events.filter(e => e.name !== 'spawn' && e.type !== 'npc');

  // ---- 玩家 ----
  const player = {
    x: spawn.x + (spawn.width - CFG.PLAYER_W) / 2,
    y: spawn.y + (spawn.height - CFG.PLAYER_H) / 2,
    vx: 0, vy: 0,
    dir: 'down', moving: false
  };

  // ---- 输入 ----
  const keys = {};
  const nearNpc = () => npcs.find(n => {
    const r = 44; // 交互半径 px
    const cx = n.x + (n.width || 32) / 2, cy = n.y + (n.height || 48) / 2;
    const px = player.x + CFG.PLAYER_W / 2, py = player.y + CFG.PLAYER_H / 2;
    return Math.abs(px - cx) < r && Math.abs(py - cy) < r;
  });
  const overlapTriggers = () => {
    const cx = player.x + CFG.PLAYER_W / 2, cy = player.y + CFG.PLAYER_H / 2;
    return triggers.filter(e =>
      cx >= e.x && cx <= e.x + (e.width || 32) &&
      cy >= e.y && cy <= e.y + (e.height || 32)
    ).map(e => e.name);
  };

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (Dialogue.active) { Dialogue.onKey(e.code); return; }   // 对话中：按键交给对话
    if (e.code === 'Space') {
      const n = nearNpc();
      if (n) { Dialogue.start(n.name); return; }
      const hit = overlapTriggers();
      if (hit.length) console.log('[触发点] ' + hit.join(', '));
    }
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('click', e => {
    if (!Dialogue.active) return;
    const r = canvas.getBoundingClientRect();
    Dialogue.onClick(e.clientX - r.left, e.clientY - r.top);
  });

  // ---- 碰撞：逐轴移动 + 回退 ----
  const moveAxis = (axis, delta) => {
    if (axis === 'x') player.x += delta; else player.y += delta;
    const maxX = W * TILE - CFG.PLAYER_W, maxY = H * TILE - CFG.PLAYER_H;
    if (axis === 'x') { if (player.x < 0) player.x = 0; if (player.x > maxX) player.x = maxX; }
    else { if (player.y < 0) player.y = 0; if (player.y > maxY) player.y = maxY; }
    const px = player.x + CFG.PLAYER_W / 2;
    const py = player.y + CFG.PLAYER_H - 4;
    const r = CFG.PLAYER_W / 2, b = CFG.PLAYER_H - 4;
    const tx0 = Math.floor((px - r) / TILE), tx1 = Math.floor((px + r - 1) / TILE);
    const ty0 = Math.floor((py - b) / TILE), ty1 = Math.floor((py - 1) / TILE);
    let blocked = false;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (solid(tx, ty)) { blocked = true; break; }
      }
      if (blocked) break;
    }
    if (blocked) { if (axis === 'x') player.x -= delta; else player.y -= delta; }
  };

  // ---- 镜头跟随 ----
  const cam = { x: 0, y: 0 };
  const updateCam = () => {
    cam.x = player.x + CFG.PLAYER_W / 2 - CFG.VIEW_W / 2;
    cam.y = player.y + CFG.PLAYER_H / 2 - CFG.VIEW_H / 2;
    cam.x = Math.max(0, Math.min(cam.x, W * TILE - CFG.VIEW_W));
    cam.y = Math.max(0, Math.min(cam.y, H * TILE - CFG.VIEW_H));
  };

  // ---- NPC 占位绘制（真实精灵表就绪后替换） ----
  function npcMeta(id) { return (window.NPC_META && window.NPC_META[id]) || { name: id, color: '#B98A5A' }; }
  const drawNpcs = () => {
    for (const n of npcs) {
      const meta = npcMeta(n.name);
      const x = Math.round(n.x - cam.x), y = Math.round(n.y - cam.y);
      ctx.fillStyle = '#4A3B32';                       // 头发
      ctx.fillRect(x + 4, y, 24, 10);
      ctx.fillStyle = '#F2C9A0';                       // 脸
      ctx.fillRect(x + 5, y + 10, 22, 6);
      ctx.fillStyle = meta.color;                      // 衣服（按角色配色）
      ctx.fillRect(x + 2, y + 16, 28, 18);
      ctx.fillStyle = '#B98A5A';                       // 裤子
      ctx.fillRect(x + 6, y + 34, 20, 10);
      ctx.fillStyle = '#4A3B32';                       // 名字
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(meta.name, x + 16, y - 4);
      ctx.textAlign = 'left';
    }
  };

  // ---- 玩家占位绘制 ----
  const drawPlayer = () => {
    const x = Math.round(player.x - cam.x), y = Math.round(player.y - cam.y);
    ctx.fillStyle = '#4A3B32';                       // 头发
    ctx.fillRect(x + 4, y, 24, 10);
    ctx.fillStyle = '#F2C9A0';                       // 脸
    ctx.fillRect(x + 5, y + 10, 22, 6);
    ctx.fillStyle = '#7FB5C9';                       // 上衣
    ctx.fillRect(x + 2, y + 16, 28, 18);
    ctx.fillStyle = '#B98A5A';                       // 裤子
    ctx.fillRect(x + 6, y + 34, 20, 10);
    ctx.fillStyle = '#3E4A3C';                       // 眼睛（朝向感）
    const ex = player.dir === 'left' ? x + 8 : player.dir === 'right' ? x + 22 : x + 13;
    ctx.fillRect(ex, y + 11, 6, 3);
  };

  // ---- 主循环 ----
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (!Dialogue.active) {
      let dx = 0, dy = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
      if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
      if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
      if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
      const len = Math.hypot(dx, dy);
      player.moving = len > 0;
      if (player.moving) {
        player.vx = dx / len * CFG.PLAYER_SPEED;
        player.vy = dy / len * CFG.PLAYER_SPEED;
        if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
        else if (dy !== 0) player.dir = dy > 0 ? 'down' : 'up';
      } else { player.vx = 0; player.vy = 0; }
      moveAxis('x', player.vx * dt);
      moveAxis('y', player.vy * dt);
    }
    updateCam();

    // 绘制场景
    ctx.fillStyle = '#F5EFE0';
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    ctx.drawImage(mapCanvas, Math.round(-cam.x), Math.round(-cam.y));
    drawNpcs();
    drawPlayer();

    // HUD
    const tx = Math.floor((player.x + CFG.PLAYER_W / 2) / TILE);
    const ty = Math.floor((player.y + CFG.PLAYER_H / 2) / TILE);
    ctx.fillStyle = 'rgba(74,59,50,0.85)';
    ctx.font = '14px system-ui';
    if (Dialogue.active) {
      ctx.fillText('对话中 · 空格推进 · 数字键/点击选项', 8, 20);
    } else {
      ctx.fillText('位置 (' + tx + ',' + ty + ') · WASD/方向键移动 · 空格互动', 8, 20);
      const n = nearNpc();
      if (n) ctx.fillText('按空格与 ' + npcMeta(n.name).name + ' 对话', 8, 40);
      else {
        const hit = overlapTriggers();
        if (hit.length) ctx.fillText('触发点：' + hit.join(' / '), 8, 40);
      }
    }

    // 对话层
    Dialogue.update(dt);
    Dialogue.draw(ctx, CFG.VIEW_W, CFG.VIEW_H);

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
