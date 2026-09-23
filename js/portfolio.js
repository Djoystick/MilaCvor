/**
 * Portfolio & Fullscreen Touch Lightbox Module
 * Standard: Production Web Craft (Zero-CLS, Uniform Alignment, 60fps, Touch-enabled)
 */

const portfolioData = [
  {
    id: 1,
    title: "Осенняя сказка: образ маленькой лисички",
    category: "fairy",
    categoryLabel: "Сказочные образы",
    image: "assets/images/fairy_autumn_fox.jpg",
    description: "Авторский костюм, тематический аквагрим от Милы Цвор, золотая листва и живой взгляд маленькой героини."
  },
  {
    id: 2,
    title: "Маленький ангел: щелчок затвора останавливает время",
    category: "fairy",
    categoryLabel: "Сказочные образы",
    image: "assets/images/photo_16.jpg",
    description: "Нежный воздушный образ ангела с перьевыми крыльями и мягким рассеянным закатным светом на холме."
  },
  {
    id: 3,
    title: "Тепло сестринской любви: в сказочном лесу",
    category: "family",
    categoryLabel: "Детские & Семейные",
    image: "assets/images/photo_04.jpg",
    description: "Искренние детские эмоции и живой смех без заученных поз на мшистом пеньке в лесу."
  },
  {
    id: 4,
    title: "Осенняя кружка-лисичка: тепло в золотой листве",
    category: "autumn",
    categoryLabel: "Осенние истории",
    image: "assets/images/photo_08.jpg",
    description: "Уютный образ с тематическим реквизитом, венком из осенних цветов и золотым сиянием солнца."
  },
  {
    id: 5,
    title: "Маленькая фея в розовом платье",
    category: "fairy",
    categoryLabel: "Сказочные образы",
    image: "assets/images/photo_07.jpg",
    description: "Воздушное фатиновое платье, мерцающие крылья и любимая плюшевая игрушка в руках юной принцессы."
  },
  {
    id: 6,
    title: "Лесная нимфа: нежные крылья и мягкий закат",
    category: "fairy",
    categoryLabel: "Сказочные образы",
    image: "assets/images/album_-240592099_457239246.jpg",
    description: "Полное погружение в сказочный сюжет: венки ручной работы, сказочные аксессуары и естественный свет."
  },
  {
    id: 7,
    title: "Сказка на лесной поляне: белый наряд феи",
    category: "fairy",
    categoryLabel: "Сказочные образы",
    image: "assets/images/album_-240592099_457239263.jpg",
    description: "Легкость, чистота и искреннее удивление ребенка окружающему миру среди зелени леса."
  },
  {
    id: 8,
    title: "Сестрички-феи: фотопрогулка в парке",
    category: "family",
    categoryLabel: "Детские & Семейные",
    image: "assets/images/photo_12.jpg",
    description: "Парная сказочная фотосессия сестер: нежные платья, парные крылья и теплая дружба."
  },
  {
    id: 9,
    title: "Цветочные венки и сказочные бабочки",
    category: "family",
    categoryLabel: "Детские & Семейные",
    image: "assets/images/photo_13.jpg",
    description: "Крупный план детской искренности. Детали авторских украшений и сияющие глаза."
  },
  {
    id: 10,
    title: "Синий василек и ромашковый берег",
    category: "family",
    categoryLabel: "Детские & Семейные",
    image: "assets/images/photo_14.jpg",
    description: "Иллюстрация к песне о родных просторах. Синее льняное платье и букет алых маков."
  },
  {
    id: 11,
    title: "Иллюстрация «Россиянка я»",
    category: "portrait",
    categoryLabel: "Женский арт-портрет",
    image: "assets/images/photo_15.jpg",
    description: "Стилизованный портрет с традиционными акцентами: белая, синяя и красная бусины на открытых ладонях."
  },
  {
    id: 12,
    title: "Солнечные одуванчики: чистая радость",
    category: "family",
    categoryLabel: "Детские & Семейные",
    image: "assets/images/album_-240592099_457239256.jpg",
    description: "Весенне-летняя беззаботность: мягкие пушистые одуванчики, венок из цветов и солнечные блики."
  }
];

class PortfolioManager {
  constructor() {
    this.grid = document.getElementById('portfolio-grid');
    this.filterButtons = document.querySelectorAll('.filter-btn');
    this.lightbox = document.getElementById('portfolio-lightbox');
    this.lightboxImg = document.getElementById('lightbox-image');
    this.lightboxTitle = document.getElementById('lightbox-title');
    this.lightboxCategory = document.getElementById('lightbox-category');
    this.lightboxDesc = document.getElementById('lightbox-desc');
    this.lightboxCounter = document.getElementById('lightbox-counter');
    this.closeBtn = document.getElementById('lightbox-close');
    this.prevBtn = document.getElementById('lightbox-prev');
    this.nextBtn = document.getElementById('lightbox-next');

    this.currentCategory = 'all';
    this.filteredItems = [...portfolioData];
    this.currentIndex = 0;
    this.isExpanded = false;
    this.expandContainer = document.getElementById('portfolio-expand-container');

    // Touch gesture state
    this.touchStartX = 0;
    this.touchEndX = 0;

    this.init();
  }

  init() {
    this.renderGrid();
    this.bindFilters();
    this.bindLightbox();
  }

  renderGrid() {
    if (!this.grid) return;
    this.grid.innerHTML = '';

    const isMobile = window.innerWidth < 768;
    // On mobile when viewing 'all' and not expanded, show initial 6 curated photos
    const shouldLimit = isMobile && this.currentCategory === 'all' && !this.isExpanded;
    const itemsToRender = shouldLimit ? this.filteredItems.slice(0, 6) : this.filteredItems;

    itemsToRender.forEach((item, index) => {
      const realIndex = this.filteredItems.findIndex(i => i.id === item.id);
      const card = document.createElement('div');
      // UNIFORM ASPECT RATIO (aspect-[3/4]) FOR MATHEMATICALLY PERFECT GRID ALIGNMENT
      card.className = 'portfolio-item group relative overflow-hidden rounded-2xl bg-surface-card border border-white/5 cursor-pointer transition-all duration-300 hover:border-accent-gold/50 hover:-translate-y-1 active:scale-[0.98] aspect-[3/4] w-full shadow-lg';
      card.setAttribute('data-id', item.id);
      card.setAttribute('data-category', item.category);

      card.innerHTML = `
        <div class="skeleton-box absolute inset-0 z-0"></div>
        <img 
          src="${item.image}" 
          alt="${item.title}" 
          loading="lazy" 
          class="relative z-10 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          onload="this.previousElementSibling.style.display='none'"
        />

        <!-- Mobile Zoom Badge (Direct visual cue that photo enlarges on tap) -->
        <div class="absolute top-2.5 right-2.5 z-20 md:hidden portfolio-zoom-badge px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-md">
          <svg class="w-3 h-3 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
          <span>Увеличить</span>
        </div>

        <div class="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/35 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 sm:p-5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-accent-gold-light mb-1">${item.categoryLabel}</span>
          <h4 class="text-sm sm:text-base font-serif font-medium text-white leading-snug">${item.title}</h4>
          <p class="text-xs text-zinc-300 mt-1 line-clamp-2 hidden sm:block">${item.description}</p>
          <div class="mt-2.5 flex items-center text-xs text-white/90 font-medium gap-1.5">
            <span>Открыть в полном размере</span>
            <svg class="w-3.5 h-3.5 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </div>
        </div>
      `;

      // Reliable tap & click handlers for instant touch response
      let touchMoved = false;
      card.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
      card.addEventListener('touchend', (e) => {
        if (!touchMoved) {
          e.preventDefault();
          this.openLightbox(realIndex);
        }
        touchMoved = false;
      });
      card.addEventListener('click', () => {
        this.openLightbox(realIndex);
      });

      this.grid.appendChild(card);
    });

    this.renderExpandButton(shouldLimit);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  renderExpandButton(isLimited) {
    if (!this.expandContainer) return;

    if (this.currentCategory !== 'all' || this.filteredItems.length <= 6) {
      this.expandContainer.innerHTML = '';
      return;
    }

    if (isLimited) {
      this.expandContainer.innerHTML = `
        <button id="portfolio-expand-btn" type="button" class="inline-flex items-center gap-2 px-6 py-3 rounded-2xl btn-ghost border border-accent-fairy-pink/30 text-xs sm:text-sm font-semibold text-zinc-200 hover:text-white shadow-lg active:scale-95 transition-all">
          <svg class="w-4 h-4 text-accent-rose-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>Смотреть все 12 фотографий</span>
          <span class="px-2 py-0.5 rounded-full bg-accent-fairy-pink/20 text-accent-fairy-pink text-[11px] font-mono">+6</span>
        </button>
      `;
    } else {
      this.expandContainer.innerHTML = `
        <button id="portfolio-collapse-btn" type="button" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl btn-ghost border border-white/10 text-xs text-zinc-400 hover:text-white active:scale-95 transition-all">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
          <span>Свернуть до 6 фото</span>
        </button>
      `;
    }

    const btn = this.expandContainer.querySelector('button');
    btn?.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      this.renderGrid();
      if (!this.isExpanded) {
        document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  bindFilters() {
    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-filter');
        this.currentCategory = cat;

        // Active state classes
        this.filterButtons.forEach(b => {
          b.classList.remove('bg-accent-gold', 'text-black', 'border-accent-gold');
          b.classList.add('bg-white/5', 'text-zinc-300', 'border-white/10');
        });
        btn.classList.add('bg-accent-gold', 'text-black', 'border-accent-gold');
        btn.classList.remove('bg-white/5', 'text-zinc-300', 'border-white/10');

        // Filter items
        if (cat === 'all') {
          this.filteredItems = [...portfolioData];
        } else {
          this.filteredItems = portfolioData.filter(item => item.category === cat);
        }

        this.renderGrid();
      });
    });
  }

  bindLightbox() {
    if (!this.lightbox) return;

    this.closeBtn?.addEventListener('click', () => this.closeLightbox());
    this.prevBtn?.addEventListener('click', () => this.prevPhoto());
    this.nextBtn?.addEventListener('click', () => this.nextPhoto());

    // Click outside image container to close
    this.lightbox.addEventListener('click', (e) => {
      if (e.target === this.lightbox || e.target.classList.contains('lightbox-backdrop')) {
        this.closeLightbox();
      }
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.prevPhoto();
      if (e.key === 'ArrowRight') this.nextPhoto();
    });

    // Touch swipe gestures
    this.lightbox.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    this.lightbox.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleTouchSwipe();
    }, { passive: true });
  }

  handleTouchSwipe() {
    const swipeThreshold = 50;
    const diff = this.touchEndX - this.touchStartX;
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swiped right -> prev
        this.prevPhoto();
      } else {
        // Swiped left -> next
        this.nextPhoto();
      }
    }
  }

  openLightbox(index) {
    this.currentIndex = index;
    this.updateLightboxContent();
    this.lightbox.classList.add('active');
    this.lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  closeLightbox() {
    this.lightbox.classList.remove('active');
    this.lightbox.style.display = '';
    document.body.style.overflow = '';
  }

  prevPhoto() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.filteredItems.length - 1;
    }
    this.updateLightboxContent();
  }

  nextPhoto() {
    if (this.currentIndex < this.filteredItems.length - 1) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0;
    }
    this.updateLightboxContent();
  }

  updateLightboxContent() {
    const item = this.filteredItems[this.currentIndex];
    if (!item) return;

    if (this.lightboxImg) {
      this.lightboxImg.src = item.image;
      this.lightboxImg.alt = item.title;
    }
    if (this.lightboxTitle) this.lightboxTitle.textContent = item.title;
    if (this.lightboxCategory) this.lightboxCategory.textContent = item.categoryLabel;
    if (this.lightboxDesc) this.lightboxDesc.textContent = item.description;
    if (this.lightboxCounter) {
      const cur = String(this.currentIndex + 1).padStart(2, '0');
      const total = String(this.filteredItems.length).padStart(2, '0');
      this.lightboxCounter.textContent = `${cur} / ${total}`;
    }
  }
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.portfolioManager = new PortfolioManager();
});
