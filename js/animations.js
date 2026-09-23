/**
 * GSAP Microanimations, Fairy Magic Foreground System & WOW-Effects
 * Theme: Dual Mode (Royal Velvet Plum / Dawn Pearl Rose-Gold)
 * Standard: Production Web Craft (60 FPS, Compositor properties only)
 */

// 1. Dual Canvas Fairy Magic System (Foreground Magic + Background Dust)
class FairyMagicSystem {
  constructor() {
    this.bgCanvas = document.getElementById('fairy-particles');
    this.magicCanvas = document.getElementById('fairy-magic-canvas');
    if (!this.bgCanvas && !this.magicCanvas) return;

    this.bgCtx = this.bgCanvas ? this.bgCanvas.getContext('2d') : null;
    this.magicCtx = this.magicCanvas ? this.magicCanvas.getContext('2d') : null;

    this.bgParticles = [];
    this.trailParticles = [];
    this.flashBursts = [];
    this.lensBlooms = [];

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.isMobile = window.innerWidth < 768;
    this.maxTrail = this.isMobile ? 22 : 45;
    this.bgCount = this.isMobile ? 25 : 55;

    this.lastX = this.width / 2;
    this.lastY = this.height / 2;

    this.darkColors = [
      'rgba(245, 215, 160, ', // Champagne gold
      'rgba(246, 194, 217, ', // Fairy pink
      'rgba(240, 184, 132, ', // Rose gold
      'rgba(255, 255, 255, '  // Pure starlight
    ];

    this.lightColors = [
      'rgba(205, 115, 60, ',  // Deep warm amber gold
      'rgba(178, 72, 114, ',  // Rich fairy plum
      'rgba(215, 135, 95, ',  // Rosy peach gold
      'rgba(235, 105, 155, '  // Vivid fairy rose
    ];

    this.updateThemeColors();
    this.resizeCanvases();
    this.init();
  }

  updateThemeColors() {
    const isLight = document.documentElement.classList.contains('light');
    this.colors = isLight ? this.lightColors : this.darkColors;
  }

  updateTheme(theme) {
    this.colors = theme === 'light' ? this.lightColors : this.darkColors;
    for (let p of this.bgParticles) {
      p.colorBase = this.colors[Math.floor(Math.random() * this.colors.length)];
    }
  }

  resizeCanvases() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.isMobile = window.innerWidth < 768;
    this.maxTrail = this.isMobile ? 22 : 45;

    if (this.bgCanvas) {
      this.bgCanvas.width = this.width;
      this.bgCanvas.height = this.height;
    }
    if (this.magicCanvas) {
      this.magicCanvas.width = this.width;
      this.magicCanvas.height = this.height;
    }
  }

  init() {
    // 1. Initialize Background Ambient Particles
    this.bgParticles = [];
    for (let i = 0; i < this.bgCount; i++) {
      this.bgParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 2 + 0.6,
        colorBase: this.colors[Math.floor(Math.random() * this.colors.length)],
        alpha: Math.random() * 0.7 + 0.2,
        speedY: Math.random() * 0.45 + 0.15,
        speedX: (Math.random() - 0.5) * 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.008,
        twinkleDir: Math.random() > 0.5 ? 1 : -1
      });
    }

    // 2. Window Resize
    window.addEventListener('resize', () => this.resizeCanvases(), { passive: true });

    // 3. Desktop Fairy Wand Cursor Trail
    window.addEventListener('mousemove', (e) => {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      const dist = Math.hypot(dx, dy);

      if (dist > 6 && this.trailParticles.length < this.maxTrail) {
        this.spawnWandParticle(e.clientX, e.clientY);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    }, { passive: true });

    // 4. Desktop & Pointer Fairy Camera Click Flash
    window.addEventListener('pointerdown', (e) => {
      // Ignore if it's already a touch event (handled separately)
      if (e.pointerType === 'touch') return;
      this.spawnCameraFlash(e.clientX, e.clientY);
    }, { passive: true });

    // 5. Mobile Magic Touch: Finger Starlight Trail & Camera Flash
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const dx = touch.clientX - this.lastX;
        const dy = touch.clientY - this.lastY;
        const dist = Math.hypot(dx, dy);

        if (dist > 12 && this.trailParticles.length < this.maxTrail) {
          this.spawnWandParticle(touch.clientX, touch.clientY, true);
          this.lastX = touch.clientX;
          this.lastY = touch.clientY;
        }
      }
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        this.lastX = touch.clientX;
        this.lastY = touch.clientY;
        this.spawnCameraFlash(touch.clientX, touch.clientY);

        // Tactile Haptic Feedback for physical camera shutter sensation
        if (navigator.vibrate) {
          try {
            navigator.vibrate(10);
          } catch (_) {}
        }
      }
    }, { passive: true });

    this.animate();
  }

  spawnWandParticle(x, y, isTouch = false) {
    const isStar = Math.random() > 0.3;
    const size = isStar ? (Math.random() * 3.5 + 2.5) : (Math.random() * 2 + 1);

    this.trailParticles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * (isTouch ? 1.2 : 0.8),
      vy: Math.random() * 0.6 + 0.3,
      size: size,
      isStar: isStar,
      colorBase: this.colors[Math.floor(Math.random() * this.colors.length)],
      alpha: 1.0,
      decay: isTouch ? (Math.random() * 0.04 + 0.025) : (Math.random() * 0.028 + 0.016),
      rotation: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.1
    });
  }

  spawnCameraFlash(x, y) {
    if (this.flashBursts.length > 6) return;

    // 1. Soft Camera Lens Bloom (Radial Exposure Flash)
    this.lensBlooms.push({
      x: x,
      y: y,
      radius: 12,
      maxRadius: this.isMobile ? 85 : 120,
      alpha: 0.8,
      speed: 4.5,
      colorBase: this.colors[0]
    });

    // 2. Expanding Camera Shutter Ring
    this.flashBursts.push({
      type: 'ring',
      x: x,
      y: y,
      radius: 4,
      maxRadius: this.isMobile ? 45 : 60,
      alpha: 0.9,
      colorBase: this.colors[0],
      speed: 3.2
    });

    // 3. Starburst Sparks Shooting Radially
    const sparkCount = this.isMobile ? 8 : 14;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 / sparkCount) * i + (Math.random() - 0.5) * 0.35;
      const speed = Math.random() * 3.2 + 1.8;
      this.trailParticles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.5 + 2,
        isStar: true,
        colorBase: this.colors[Math.floor(Math.random() * this.colors.length)],
        alpha: 1.0,
        decay: 0.035,
        rotation: angle,
        rotSpeed: 0.12
      });
    }
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  animate() {
    // -------------------------------------------------------------
    // A. Render Ambient Background Canvas (Behind main content)
    // -------------------------------------------------------------
    if (this.bgCtx) {
      this.bgCtx.clearRect(0, 0, this.width, this.height);

      for (let p of this.bgParticles) {
        p.alpha += p.twinkleSpeed * p.twinkleDir;
        if (p.alpha > 0.85) {
          p.alpha = 0.85;
          p.twinkleDir = -1;
        } else if (p.alpha < 0.15) {
          p.alpha = 0.15;
          p.twinkleDir = 1;
        }

        p.y -= p.speedY;
        p.x += p.speedX;

        if (p.y < -10) {
          p.y = this.height + 10;
          p.x = Math.random() * this.width;
        }
        if (p.x < -10) p.x = this.width + 10;
        if (p.x > this.width + 10) p.x = -10;

        this.bgCtx.beginPath();
        this.bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.bgCtx.fillStyle = p.colorBase + p.alpha + ')';
        this.bgCtx.shadowBlur = p.radius * 3;
        this.bgCtx.shadowColor = p.colorBase + '0.7)';
        this.bgCtx.fill();
      }
    }

    // -------------------------------------------------------------
    // B. Render Foreground Magic Canvas (Above all DOM elements)
    // -------------------------------------------------------------
    if (this.magicCtx) {
      this.magicCtx.clearRect(0, 0, this.width, this.height);

      // 1. Camera Lens Exposure Blooms (Soft Flash Glow)
      for (let i = this.lensBlooms.length - 1; i >= 0; i--) {
        const lb = this.lensBlooms[i];
        lb.radius += lb.speed;
        lb.alpha -= 0.045;

        if (lb.alpha <= 0 || lb.radius >= lb.maxRadius) {
          this.lensBlooms.splice(i, 1);
          continue;
        }

        const gradient = this.magicCtx.createRadialGradient(lb.x, lb.y, 0, lb.x, lb.y, lb.radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, ' + lb.alpha + ')');
        gradient.addColorStop(0.4, lb.colorBase + (lb.alpha * 0.7) + ')');
        gradient.addColorStop(1, lb.colorBase + '0)');

        this.magicCtx.save();
        this.magicCtx.beginPath();
        this.magicCtx.arc(lb.x, lb.y, lb.radius, 0, Math.PI * 2);
        this.magicCtx.fillStyle = gradient;
        this.magicCtx.fill();
        this.magicCtx.restore();
      }

      // 2. Camera Click Flash Rings (Sharp Shutter Ring)
      for (let i = this.flashBursts.length - 1; i >= 0; i--) {
        const f = this.flashBursts[i];
        f.radius += f.speed;
        f.alpha -= 0.038;

        if (f.alpha <= 0 || f.radius >= f.maxRadius) {
          this.flashBursts.splice(i, 1);
          continue;
        }

        this.magicCtx.save();
        this.magicCtx.beginPath();
        this.magicCtx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        this.magicCtx.strokeStyle = f.colorBase + f.alpha + ')';
        this.magicCtx.lineWidth = 1.8;
        this.magicCtx.shadowBlur = 10;
        this.magicCtx.shadowColor = f.colorBase + '0.9)';
        this.magicCtx.stroke();
        this.magicCtx.restore();
      }

      // 3. Fairy Wand & Mobile Touch Starlight Sparks
      for (let i = this.trailParticles.length - 1; i >= 0; i--) {
        const tp = this.trailParticles[i];
        tp.x += tp.vx;
        tp.y += tp.vy;
        tp.alpha -= tp.decay;
        tp.rotation += tp.rotSpeed;

        if (tp.alpha <= 0) {
          this.trailParticles.splice(i, 1);
          continue;
        }

        this.magicCtx.save();
        this.magicCtx.translate(tp.x, tp.y);
        this.magicCtx.rotate(tp.rotation);
        this.magicCtx.fillStyle = tp.colorBase + tp.alpha + ')';
        this.magicCtx.shadowBlur = tp.size * 3.5;
        this.magicCtx.shadowColor = tp.colorBase + '0.9)';

        if (tp.isStar) {
          this.drawStar(this.magicCtx, 0, 0, 4, tp.size, tp.size * 0.32);
        } else {
          this.magicCtx.beginPath();
          this.magicCtx.arc(0, 0, tp.size, 0, Math.PI * 2);
          this.magicCtx.fill();
        }
        this.magicCtx.restore();
      }
    }

    requestAnimationFrame(() => this.animate());
  }
}

// 2. Top Luxury Scroll Progress Indicator
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;

  const update = () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight <= 0) return;
    const progress = (window.scrollY / totalHeight) * 100;
    bar.style.width = Math.min(100, Math.max(0, progress)) + '%';
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

// 3. 3D Card Hover Perspective Effect
function initCardTilt() {
  if (window.innerWidth < 768) return; // desktop only for performance

  const cards = document.querySelectorAll('.card-hover, .portfolio-item');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -4.5;
      const rotateY = ((x - centerX) / centerX) * 4.5;

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// 4. GSAP Animations and Load Sequence
document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Initialize Top Scroll Progress
  initScrollProgress();

  // Initialize Lucide icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // Initialize Fairy Magic System (Foreground + Background)
  if (!prefersReducedMotion) {
    window.fairyDustSystem = new FairyMagicSystem();
    initCardTilt();
  }

  if (prefersReducedMotion || typeof gsap === 'undefined') {
    document.querySelectorAll('.reveal-on-scroll').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  // Register ScrollTrigger if available
  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // Hero Reveal Timeline
  const heroTL = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.9 } });

  heroTL
    .from('#main-nav', { y: -35, opacity: 0, duration: 0.8 })
    .from('.hero-badge', { y: 20, opacity: 0, duration: 0.6, scale: 0.95 }, '-=0.3')
    .from('.hero-title', { y: 35, opacity: 0, duration: 0.9 }, '-=0.4')
    .from('.hero-sub', { y: 25, opacity: 0, duration: 0.8 }, '-=0.5')
    .from('.hero-cta', { y: 20, opacity: 0, stagger: 0.15, duration: 0.65 }, '-=0.4')
    .from('.hero-visual', { scale: 0.95, opacity: 0, duration: 1.1, ease: 'power2.out' }, '-=0.8')
    .from('.hero-trust-cards', { y: 30, opacity: 0, duration: 0.8 }, '-=0.5');

  // Scroll Trigger for Sections
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  revealElements.forEach(el => {
    gsap.fromTo(
      el,
      { y: 35, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      }
    );
  });

  // Stagger Cards in Pricing & Features
  const cardGrids = document.querySelectorAll('.stagger-cards');
  cardGrids.forEach(grid => {
    const cards = grid.children;
    gsap.fromTo(
      cards,
      { y: 35, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.75,
        stagger: 0.12,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: grid,
          start: 'top 82%',
          toggleActions: 'play none none none'
        }
      }
    );
  });
});
