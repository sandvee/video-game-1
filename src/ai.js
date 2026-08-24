// M3 AI 客户端：Key 管理 + 系统提示词构建 + 请求重试 + 多格式宽容解析
// 协议（决策 D50）：JSON 优先（{"reply","options","event"}）→ 标记回退 → 纯文本回退
window.AI = (() => {
  'use strict';

  const KEY = 'ds_api_key';
  const MODEL = 'deepseek-v4-flash';
  const WORLD = '云杉镇：一座河边小镇，三百多口人，以「树影咖啡馆」与手作面包闻名。主角小夏（20 岁，大一学生）暑假回乡帮舅舅（林叔）打理咖啡馆。基调平淡温柔，允许一点轻悬念（“河边的光”），但整体治愈不压抑。';
  const EVENT_POOL = ['bench_bread', 'river_rumor', 'su_li_invite'];

  function getKey() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { localStorage.setItem(KEY, String(k).trim()); } catch (e) { /* 忽略 */ } }
  function ready() { return !!getKey(); }

  // 事件 id 模糊匹配：修复实测中的丢首字问题（ench_bread → bench_bread）
  function matchEvent(id) {
    if (!id) return null;
    const t = String(id).trim();
    if (EVENT_POOL.includes(t)) return t;
    return EVENT_POOL.find(p => p.endsWith(t) || t.endsWith(p) || p.includes(t) || t.includes(p)) || null;
  }

  // 多格式宽容解析：JSON → [选项]/[事件] 标记 → 纯文本
  function parseReply(text) {
    const t = String(text).trim();
    if (!t) return { reply: '', options: [], event: null };
    // 1) JSON
    const jm = t.match(/\{[\s\S]*\}/);
    if (jm) {
      try {
        const j = JSON.parse(jm[0]);
        if (j && typeof j.reply === 'string') {
          const options = Array.isArray(j.options)
            ? j.options.map(String).filter(s => s && s.trim()).slice(0, 4)
            : [];
          return { reply: j.reply.trim(), options, event: matchEvent(j.event) };
        }
      } catch (e) { /* 落空则尝试标记协议 */ }
    }
    // 2) 标记协议
    const replyParts = [], options = [];
    let event = null;
    for (const raw of t.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('[选项]')) options.push(line.slice(4).trim());
      else if (line.startsWith('[事件]')) event = matchEvent(line.slice(5).trim());
      else replyParts.push(line);
    }
    if (replyParts.length || options.length) {
      return { reply: replyParts.join('\n'), options: options.slice(0, 4), event };
    }
    // 3) 纯文本
    return { reply: t, options: [], event: null };
  }

  function buildSystem(npcId, stateText) {
    const p = (window.PERSONAS && window.PERSONAS[npcId]) || {};
    const name = p.name || npcId;
    const forbidden = (p.forbidden && p.forbidden.length)
      ? p.forbidden.join('；')
      : '剧透未发生剧情；提到不存在的人物/地点；打破第四面墙；让主角或 NPC 死亡';
    return [
      '【角色】你是《治愈小镇》里的' + name + '。' + (p.persona || ''),
      '【世界观】' + WORLD,
      '【风格】平淡温柔治愈的中文口语，每句 30 字以内，不用网络流行语。',
      '【剧情状态】' + (stateText || '（暂无特殊状态）'),
      p.relation ? '【与主角的关系】' + p.relation : '',
      '【输出格式】只输出一个 JSON 对象，不要 markdown 代码块，不要其他文字：',
      '{"reply":"你的台词(1-3句)","options":["选项1","选项2","选项3"],"event":"事件id或空字符串"}',
      '规则：reply 必填；options 必填 2-4 个、每个 12 字以内的口语短语；event 可选，只能用下面的事件 id，没有就填空字符串。',
      '【事件池】' + EVENT_POOL.join('；'),
      '【禁令】' + forbidden + '。不要在 reply 里出现标记或 JSON 以外的内容。',
      '【示例】{"reply":"嗯，来啦。今天面包刚出炉。","options":["尝尝面包","问问最近的事","去河边看看"],"event":""}'
    ].filter(Boolean).join('\n');
  }

  // 单次对话调用：失败重试 1 次，仍失败抛错（由调用方兜底）
  async function chat({ npcId, history, user, stateText }) {
    const sys = buildSystem(npcId, stateText);
    const messages = [{ role: 'system', content: sys }]
      .concat(history || [])
      .concat([{ role: 'user', content: user }]);
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getKey() },
          body: JSON.stringify({ model: MODEL, messages, stream: false, max_tokens: 400 })
        });
        if (!res.ok) { lastErr = 'HTTP ' + res.status + ': ' + (await res.text()).slice(0, 120); continue; }
        const data = await res.json();
        return data.choices[0].message.content;
      } catch (e) { lastErr = e.message; }
    }
    throw new Error(lastErr || 'AI 请求失败');
  }

  return { getKey, setKey, ready, chat, parseReply, matchEvent, MODEL };
})();
