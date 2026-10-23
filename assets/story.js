// Section paging and auto-playing motion for project detail pages
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = matchMedia('(min-width: 761px)');
  const behavior = reduce ? 'auto' : 'smooth';
  const pages = [...document.querySelectorAll('.page')];
  const bar = document.querySelector('.progress');
  const nextBtn = document.querySelector('.next-btn');

  // ----- Paging: one wheel step / key press moves one section -----
  const pager = document.createElement('nav');
  pager.className = 'pager';
  pager.setAttribute('aria-label', '섹션 이동');
  pages.forEach((page, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `${i + 1}번째 섹션으로 이동`);
    dot.addEventListener('click', () => goTo(i));
    pager.append(dot);
  });
  document.body.append(pager);

  // The section crossing the middle of the viewport
  const current = () => {
    const mid = window.innerHeight / 2;
    const i = pages.findIndex((p) => {
      const r = p.getBoundingClientRect();
      return r.top <= mid && r.bottom > mid;
    });
    return i < 0 ? 0 : i;
  };

  const goTo = (i) => {
    const target = pages[Math.max(0, Math.min(pages.length - 1, i))];
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior });
  };

  const step = (dir) => {
    const i = current();
    const r = pages[i].getBoundingClientRect();
    // A section taller than the screen scrolls within itself before moving on
    if (dir > 0 && r.bottom > window.innerHeight + 8) {
      window.scrollBy({ top: Math.min(window.innerHeight * 0.85, r.bottom - window.innerHeight), behavior });
    } else if (dir < 0 && r.top < -8) {
      window.scrollBy({ top: Math.max(-window.innerHeight * 0.85, r.top), behavior });
    } else {
      goTo(i + dir);
    }
  };

  // Trackpads fire a long stream of wheel events, so stay locked until they stop
  let locked = false;
  let lockStart = 0;
  let unlockTimer;
  const scheduleUnlock = () => {
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      if (performance.now() - lockStart > 700) locked = false;
      else scheduleUnlock();
    }, 180);
  };

  window.addEventListener('wheel', (e) => {
    if (!desktop.matches || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    e.preventDefault();
    if (locked) {
      scheduleUnlock();
      return;
    }
    if (Math.abs(e.deltaY) < 4) return;
    locked = true;
    lockStart = performance.now();
    scheduleUnlock();
    step(Math.sign(e.deltaY));
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (!desktop.matches || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === ' ' && e.target.closest('button, a')) return;
    const dir = { ArrowDown: 1, PageDown: 1, ' ': e.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    step(dir);
  });

  nextBtn?.addEventListener('click', () => step(1));

  // ----- Auto-playing graphics, replayed each time a section is entered -----
  const players = new Map();

  document.querySelectorAll('[data-stages]').forEach((el) => {
    const n = Number(el.dataset.stages);
    let timers = [];
    const set = (s) => { el.dataset.stage = s; };
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    el.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => { stop(); set(btn.dataset.go); });
    });
    players.set(el, {
      play() {
        stop();
        set(reduce ? n - 1 : 0);
        if (reduce) return;
        for (let s = 1; s < n; s++) timers.push(setTimeout(() => set(s), 200 + s * 1200));
      },
      reset() { stop(); set(reduce ? n - 1 : 0); },
    });
  });

  document.querySelectorAll('[data-scrub]').forEach((el) => {
    const words = [];
    let delay = 300;
    el.querySelectorAll('.scrub-line').forEach((line) => {
      const parts = line.textContent.trim().split(/\s+/);
      line.textContent = '';
      parts.forEach((part, i) => {
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = part;
        line.append(span, i < parts.length - 1 ? ' ' : '');
        words.push({ span, delay });
        delay += 110;
      });
      delay += 300; // short pause between lines
    });
    let timers = [];
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    players.set(el, {
      play() {
        stop();
        words.forEach(({ span, delay: d }) => {
          span.classList.toggle('lit', reduce);
          if (!reduce) timers.push(setTimeout(() => span.classList.add('lit'), d));
        });
      },
      reset() {
        stop();
        if (!reduce) words.forEach(({ span }) => span.classList.remove('lit'));
      },
    });
  });

  // Each section plays its reveals and graphics from the start every time it is entered
  const enter = (page) => {
    page.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    players.get(page)?.play();
  };
  const leave = (page) => {
    if (!reduce) page.querySelectorAll('.reveal').forEach((el) => el.classList.remove('in'));
    players.get(page)?.reset();
  };

  if ('IntersectionObserver' in window && !reduce) {
    const played = new Set();
    // Play when the section reaches the middle of the screen
    const playIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !played.has(e.target)) {
          played.add(e.target);
          enter(e.target);
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    // Reset once it is (almost) off screen; a section just touching the edge still counts as gone
    const resetIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.intersectionRatio < 0.05 && played.has(e.target)) {
          played.delete(e.target);
          leave(e.target);
        }
      });
    }, { threshold: [0, 0.05] });
    pages.forEach((page) => { playIO.observe(page); resetIO.observe(page); });
  } else {
    pages.forEach(enter);
  }

  // ----- Progress bar and active pager dot -----
  let ticking = false;
  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    if (bar) bar.style.transform = `scaleX(${doc.scrollTop / Math.max(1, doc.scrollHeight - window.innerHeight)})`;
    const i = current();
    [...pager.children].forEach((dot, j) => dot.classList.toggle('on', j === i));
    nextBtn?.classList.toggle('hidden', i === pages.length - 1);
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
