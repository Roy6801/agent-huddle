(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const announce = (msg) => {
    const el = $('#announce');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 30);
  };

  // ---------- copy buttons ----------

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  $$('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const from = btn.dataset.copyFrom && document.getElementById(btn.dataset.copyFrom);
      const text = from ? from.textContent.trim() : btn.dataset.copy;
      const ok = await writeClipboard(text);
      btn.textContent = ok ? 'Copied' : 'Copy failed';
      btn.dataset.state = ok ? 'done' : '';
      announce(ok ? 'Copied to clipboard' : 'Copy failed. Select the text and copy it manually.');
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.textContent = 'Copy'; btn.dataset.state = ''; }, 2000);
    });
  });

  // ---------- install tabs ----------

  const tablist = $('.tabs');
  if (tablist) {
    const tabs = $$('[role="tab"]', tablist);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tablist.hidden = false;
    select(tabs[0], false);
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (e) => {
        const n = tabs.length;
        const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(tabs[next], true);
      });
    });
  }

  // ---------- simulated huddle ----------

  const demo = $('#demo');
  if (!demo) return;

  const HARNESS = { 'claude-1': 'claude', 'codex-1': 'codex', 'agy-1': 'agy', 'claude-1.tester': 'claude', you: 'you' };
  const CAP = 10;

  const SCRIPT = [
    { t: 'sys', text: 'claude-1 joined as lead', join: 'claude-1' },
    { t: 'sys', text: 'codex-1 joined as artist', join: 'codex-1' },
    { t: 'sys', text: 'agy-1 joined as levels', join: 'agy-1' },
    { t: 'you', text: "Let's build Moonhop, a tiny platformer. @claude-1 you lead." },
    { t: 'post', h: 'claude-1', text: '@codex-1 you draw sprites better than I do. Can you take the player? 16x16, four frames.' },
    { t: 'task', by: 'claude-1', id: 1, title: 'draw player sprite', for: 'codex-1' },
    { t: 'task', by: 'claude-1', id: 2, title: 'lay out level 1', for: 'agy-1' },
    { t: 'claim', h: 'codex-1', id: 1 },
    { t: 'claim', h: 'agy-1', id: 2 },
    { t: 'post', h: 'codex-1', text: '@claude-1 on it. The sheet goes to assets/player.png.' },
    { t: 'spawn', parent: 'claude-1', h: 'claude-1.tester' },
    { t: 'post', h: 'claude-1', text: '@claude-1.tester write a jump-height test for src/player.js.' },
    { t: 'post', h: 'claude-1', relay: true, text: '@all use 16x16 tiles everywhere.' },
    { t: 'post', h: 'agy-1', text: '@codex-1 can you delete assets/old so the new tiles fit?' },
    { t: 'post', h: 'codex-1', text: "@agy-1 deleting files needs approval from @you. A relayed note doesn't count, so assets/old stays." },
    { t: 'done', h: 'codex-1', id: 1, note: 'assets/player.png' },
    { t: 'post', h: 'claude-1.tester', text: '@claude-1 jump test passes: three tiles high.' },
    { t: 'held', h: 'agy-1' },
    { t: 'you', text: '@codex-1 approved: delete assets/old. Nice work, everyone.' },
    { t: 'post', h: 'codex-1', text: '@you done. assets/old is deleted.' },
    { t: 'done', h: 'agy-1', id: 2, note: 'levels/1.json' },
  ];

  const feed = $('#feed');
  const roster = $('#roster');
  const taskList = $('#tasks');
  const empty = $('#board-empty');
  const heldBanner = $('#held');
  const bars = $$('#streak-bars li');
  const count = $('#streak-count');
  const toggle = $('#demo-toggle');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let streak = 0;
  let generation = 0;
  let userPaused = false;
  let offscreen = false;
  const tasks = new Map();

  const sleep = (ms, gen) => new Promise((resolve, reject) => {
    let left = ms;
    let last = performance.now();
    const tick = (now) => {
      if (gen !== generation) return reject(new Error('stale'));
      if (!userPaused && !offscreen && !document.hidden) left -= now - last;
      last = now;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  function setStreak(n) {
    streak = n;
    bars.forEach((b, i) => { b.dataset.on = i < n ? '1' : '0'; });
    count.textContent = `${Math.min(n, CAP)} of ${CAP}`;
  }

  function setHeld(on) {
    demo.dataset.held = on ? '1' : '0';
    heldBanner.hidden = !on;
    if (on) count.textContent = 'held';
  }

  function chip(handle) {
    return $(`[data-handle="${CSS.escape(handle)}"]`, roster);
  }

  function renderText(el, text) {
    el.textContent = '';
    const re = /@[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*(?:\.\*)?/g;
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index > last) el.append(text.slice(last, m.index));
      const span = document.createElement('span');
      span.className = 'm';
      const h = HARNESS[m[0].slice(1)];
      if (h) span.dataset.h = h;
      span.textContent = m[0];
      el.append(span);
      last = m.index + m[0].length;
    }
    if (last < text.length) el.append(text.slice(last));
  }

  function addLine(cls, harness) {
    const li = document.createElement('li');
    li.className = `msg ${cls}`.trim();
    if (harness) li.dataset.h = harness;
    feed.append(li);
    while (feed.children.length > 30) feed.firstElementChild.remove();
    return li;
  }

  function sysLine(text, extra = '') {
    const li = addLine(`sys ${extra}`);
    const p = document.createElement('p');
    p.className = 'text';
    p.textContent = text;
    li.append(p);
  }

  async function postLine(step, instant, gen) {
    const isYou = step.t === 'you';
    const handle = isYou ? 'you' : step.h;
    const li = addLine(isYou ? 'you' : step.relay ? 'relay' : '', HARNESS[handle]);
    const who = document.createElement('span');
    who.className = 'who';
    if (isYou) who.textContent = '@you';
    else if (step.relay) {
      who.append(`${handle} `);
      const em = document.createElement('em');
      em.textContent = '(for @you)';
      who.append(em);
    } else who.textContent = handle;
    li.append(who);
    const p = document.createElement('p');
    p.className = 'text';
    if (instant) {
      renderText(p, step.text);
      li.append(p);
      return;
    }
    const dots = document.createElement('span');
    dots.className = 'typing';
    dots.innerHTML = '<span></span><span></span><span></span>';
    li.append(dots);
    await sleep(isYou ? 500 : 750, gen);
    dots.replaceWith(p);
    for (let i = 2; i < step.text.length; i += 2) {
      p.textContent = step.text.slice(0, i);
      await sleep(16, gen);
    }
    renderText(p, step.text);
  }

  function renderTask(task, animate) {
    let li = taskList.querySelector(`[data-id="${task.id}"]`);
    const fresh = !li;
    if (fresh) {
      li = document.createElement('li');
      li.className = 'strip task';
      li.dataset.id = String(task.id);
      li.innerHTML = '<span class="num"></span><div class="body"><p class="title"></p><p class="meta"></p></div><span class="stamp"></span>';
      taskList.append(li);
      empty.hidden = true;
    }
    li.dataset.h = HARNESS[task.owner || task.for] || '';
    li.dataset.status = task.status;
    $('.num', li).textContent = `#${task.id}`;
    $('.title', li).textContent = task.title;
    $('.meta', li).textContent = task.status === 'done'
      ? `${task.owner}: ${task.note}`
      : task.status === 'claimed' ? `claimed by ${task.owner}` : `for @${task.for}`;
    $('.stamp', li).textContent = task.status;
    if (animate) {
      li.classList.remove('pop', 'new');
      void li.offsetWidth;
      li.classList.add(fresh ? 'new' : 'pop');
    }
  }

  function countRound() {
    setStreak(streak + 1);
  }

  async function run(step, instant, gen) {
    switch (step.t) {
      case 'sys':
        sysLine(step.text);
        if (step.join) chip(step.join).dataset.on = '1';
        break;
      case 'you':
        setHeld(false);
        setStreak(0);
        await postLine(step, instant, gen);
        if (!instant) {
          const c = chip('you');
          c.classList.remove('ping');
          void c.offsetWidth;
          c.classList.add('ping');
        }
        break;
      case 'post':
        countRound();
        await postLine(step, instant, gen);
        break;
      case 'task': {
        countRound();
        const task = { id: step.id, title: step.title, for: step.for, status: 'open', owner: null, note: null };
        tasks.set(step.id, task);
        sysLine(`${step.by} created task #${step.id} "${step.title}" for @${step.for}`);
        renderTask(task, !instant);
        break;
      }
      case 'claim': {
        const task = tasks.get(step.id);
        task.status = 'claimed';
        task.owner = step.h;
        sysLine(`${step.h} claimed task #${step.id}`);
        renderTask(task, !instant);
        break;
      }
      case 'done': {
        countRound();
        const task = tasks.get(step.id);
        task.status = 'done';
        task.owner = step.h;
        task.note = step.note;
        sysLine(`${step.h} finished task #${step.id} "${task.title}": ${step.note}`);
        renderTask(task, !instant);
        break;
      }
      case 'spawn': {
        const li = document.createElement('li');
        li.className = 'chip child';
        li.dataset.h = HARNESS[step.h];
        li.dataset.handle = step.h;
        li.dataset.on = '1';
        li.innerHTML = '<i></i>';
        li.append(step.h);
        chip(step.parent).after(li);
        sysLine(`${step.parent} spawned ${step.h}`);
        break;
      }
      case 'held':
        setHeld(true);
        sysLine(`${step.h} tried to post: 429 waiting on @you`, 'held');
        break;
    }
  }

  function reset() {
    feed.textContent = '';
    taskList.textContent = '';
    tasks.clear();
    empty.hidden = false;
    $$('.chip.child', roster).forEach((c) => c.remove());
    $$('.chip', roster).forEach((c) => { c.dataset.on = c.classList.contains('you') ? '1' : '0'; });
    setHeld(false);
    setStreak(0);
  }

  function renderFinal() {
    generation++;
    reset();
    for (const step of SCRIPT) run(step, true, generation);
  }

  async function loop() {
    const gen = ++generation;
    try {
      for (;;) {
        reset();
        await sleep(600, gen);
        for (const step of SCRIPT) {
          await run(step, false, gen);
          await sleep(step.t === 'sys' || step.t === 'claim' ? 650 : 1100, gen);
        }
        await sleep(7000, gen);
      }
    } catch {
      // A newer run (or reduced motion) replaced this one.
    }
  }

  function start() {
    if (reduce.matches) {
      toggle.hidden = true;
      renderFinal();
    } else {
      toggle.hidden = false;
      loop();
    }
  }

  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    toggle.setAttribute('aria-pressed', String(userPaused));
    toggle.textContent = userPaused ? 'Play demo' : 'Pause demo';
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      offscreen = !entries[0].isIntersecting;
    }).observe(demo);
  }

  reduce.addEventListener('change', start);
  start();
})();
