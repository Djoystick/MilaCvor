/**
 * Main Application Logic
 * Standard: Production Web Craft
 * Modules: Phone Mask, Interactive Calculator, Booking Form, FAQ Accordion, Mobile Nav
 */

// 1. Phone Input Mask (+7 (___) ___-__-__)
function initPhoneMask() {
  const phoneInputs = document.querySelectorAll('input[type="tel"]');

  phoneInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.startsWith('7') || val.startsWith('8')) {
        val = val.substring(1);
      }
      val = val.substring(0, 10);

      let formatted = '+7';
      if (val.length > 0) formatted += ' (' + val.substring(0, 3);
      if (val.length >= 4) formatted += ') ' + val.substring(3, 6);
      if (val.length >= 7) formatted += '-' + val.substring(6, 8);
      if (val.length >= 9) formatted += '-' + val.substring(8, 10);

      e.target.value = formatted;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value === '+7') {
        e.target.value = '';
      }
    });

    input.addEventListener('focus', (e) => {
      if (!e.target.value) {
        e.target.value = '+7 (';
      }
    });

    input.addEventListener('blur', (e) => {
      if (e.target.value === '+7' || e.target.value === '+7 (') {
        e.target.value = '';
      }
    });
  });
}

// 2. Interactive Cost Calculator
class CostCalculator {
  constructor() {
    this.packageInputs = document.querySelectorAll('input[name="calc-package"]');
    this.durationSelect = document.getElementById('calc-duration');
    this.addonCheckboxes = document.querySelectorAll('.calc-addon');
    this.totalDisplay = document.getElementById('calc-total');
    this.detailsDisplay = document.getElementById('calc-summary-text');
    this.bookBtn = document.getElementById('calc-book-btn');
    this.vkBtn = document.getElementById('calc-vk-btn');

    this.packagePrices = {
      fairy: { name: 'Сказочный образ 🧚', price: 4900, desc: 'Костюм, аквагрим, реквизит, подарок, 15 фото в ретуши' },
      family: { name: 'Семейная прогулка 🌾', price: 4500, desc: 'До 5 человек, помощь с локацией, 25 фото в ретуши' },
      portrait: { name: 'Женский арт-портрет ✨', price: 5000, desc: 'Индивидуальная стилизация, 20 фото в журнальной ретуши' },
      express: { name: 'Экспресс / Мини-сет ⚡', price: 2900, desc: '30 минут, 1 образ, 10 фото в ретуши' }
    };

    this.durationPrices = {
      standard: 0,
      extra30: 1500,
      extra60: 3000
    };

    this.currentTotal = 4900;
    this.init();
  }

  init() {
    if (!this.totalDisplay) return;

    this.packageInputs.forEach(input => {
      input.addEventListener('change', () => this.calculate());
    });

    this.durationSelect?.addEventListener('change', () => this.calculate());

    this.addonCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => this.calculate());
    });

    this.vkBtn?.addEventListener('click', () => this.sendToVk());
    this.bookBtn?.addEventListener('click', () => this.transferToBooking());

    this.calculate();
  }

  sendToVk() {
    let selectedPkg = 'fairy';
    this.packageInputs.forEach(inp => {
      if (inp.checked) selectedPkg = inp.value;
    });

    const pkgData = this.packagePrices[selectedPkg] || this.packagePrices.fairy;
    
    // Duration text
    let durationText = "Стандартная (по тарифу)";
    if (this.durationSelect) {
      const durVal = this.durationSelect.value;
      const extra30 = (this.durationPrices && this.durationPrices.extra30 !== undefined) ? this.durationPrices.extra30 : 1500;
      const extra60 = (this.durationPrices && this.durationPrices.extra60 !== undefined) ? this.durationPrices.extra60 : 3000;
      if (durVal === '1.5') durationText = `1.5 часа (+${extra30.toLocaleString('ru-RU')} ₽)`;
      else if (durVal === '2') durationText = `2 часа (+${extra60.toLocaleString('ru-RU')} ₽)`;
    }

    // Addons text
    const selectedAddonNames = [];
    this.addonCheckboxes.forEach(cb => {
      if (cb.checked) {
        const name = cb.getAttribute('data-name');
        const cost = parseInt(cb.getAttribute('data-cost'), 10) || 0;
        selectedAddonNames.push(`${name} (+${cost.toLocaleString('ru-RU')} ₽)`);
      }
    });

    const addonsText = selectedAddonNames.length > 0 ? selectedAddonNames.join(', ') : 'Без дополнительных опций';
    const totalFormatted = this.currentTotal.toLocaleString('ru-RU') + ' ₽';

    // Construct clear, structured message for VK
    const messageText = `Здравствуйте, Мила! Хочу записаться на фотосессию через ваш сайт.\n\n✨ Выбранный расчет:\n• Формат: ${pkgData.name} (${pkgData.price.toLocaleString('ru-RU')} ₽)\n• Длительность: ${durationText}\n• Доп. опции: ${addonsText}\n💰 Итоговая стоимость: ${totalFormatted}\n\nПодскажите, пожалуйста, какие даты свободны для записи?`;

    // Copy to clipboard as a safety net
    copyTextToClipboard(messageText);

    // Toast notification
    showToast('✨ Переходим в диалог ВКонтакте! Расчет скопирован в буфер.', 'success');

    // Direct redirect to VK Community Messages
    const encoded = encodeURIComponent(messageText);
    const vkUrl = `https://vk.com/im?sel=-240592099&message=${encoded}`;
    window.open(vkUrl, '_blank');
  }

  calculate() {
    let selectedPkg = 'fairy';
    this.packageInputs.forEach(inp => {
      if (inp.checked) selectedPkg = inp.value;
    });

    const pkgData = this.packagePrices[selectedPkg] || this.packagePrices.fairy;
    let basePrice = pkgData.price;

    // Duration extra
    let durationExtra = 0;
    let durationText = "Стандартная длительность";
    if (this.durationSelect) {
      const durVal = this.durationSelect.value;
      const extra30 = (this.durationPrices && this.durationPrices.extra30 !== undefined) ? this.durationPrices.extra30 : 1500;
      const extra60 = (this.durationPrices && this.durationPrices.extra60 !== undefined) ? this.durationPrices.extra60 : 3000;
      if (durVal === '1.5') {
        durationExtra = extra30;
        durationText = `1.5 часа (+${extra30.toLocaleString('ru-RU')} ₽)`;
      } else if (durVal === '2') {
        durationExtra = extra60;
        durationText = `2 часа (+${extra60.toLocaleString('ru-RU')} ₽)`;
      }
    }

    // Addons
    let addonsTotal = 0;
    const selectedAddonNames = [];
    this.addonCheckboxes.forEach(cb => {
      if (cb.checked) {
        const cost = parseInt(cb.getAttribute('data-cost'), 10) || 0;
        addonsTotal += cost;
        selectedAddonNames.push(cb.getAttribute('data-name'));
      }
    });

    const newTotal = basePrice + durationExtra + addonsTotal;
    this.animateNumber(this.currentTotal, newTotal);
    this.currentTotal = newTotal;

    // Update summary text
    if (this.detailsDisplay) {
      let summary = `${pkgData.name} • ${durationText}`;
      if (selectedAddonNames.length > 0) {
        summary += ` + ${selectedAddonNames.join(', ')}`;
      }
      this.detailsDisplay.textContent = summary;
    }
  }

  animateNumber(start, end) {
    if (!this.totalDisplay) return;
    
    // Quick number transition
    const duration = 300;
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * ease);
      
      this.totalDisplay.textContent = current.toLocaleString('ru-RU') + ' ₽';

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  }

  transferToBooking() {
    let selectedPkg = 'fairy';
    this.packageInputs.forEach(inp => {
      if (inp.checked) selectedPkg = inp.value;
    });

    const pkgSelect = document.getElementById('booking-package');
    if (pkgSelect) {
      pkgSelect.value = selectedPkg;
    }

    const commentsField = document.getElementById('booking-notes');
    if (commentsField && this.detailsDisplay) {
      commentsField.value = `Расчет из калькулятора: ${this.detailsDisplay.textContent} (Итого: ${this.currentTotal.toLocaleString('ru-RU')} ₽)`;
    }

    // Scroll to booking form
    const bookingSection = document.getElementById('booking');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        document.getElementById('booking-name')?.focus();
      }, 600);
    }
  }

  updatePrices(prices) {
    if (!prices) return;
    if (prices.packages) {
      for (const [key, pkg] of Object.entries(prices.packages)) {
        if (this.packagePrices[key]) {
          this.packagePrices[key].price = Number(pkg.price);
          if (pkg.name) this.packagePrices[key].name = pkg.name;
        }
      }
    }
    if (prices.duration) {
      this.durationPrices = {
        standard: 0,
        extra30: Number(prices.duration.extra30) || 1500,
        extra60: Number(prices.duration.extra60) || 3000
      };
    }
    this.calculate();
  }
}

// Clipboard Utility for VK & Booking pre-filled text
function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopyTextToClipboard(text);
    });
  } else {
    fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.left = "-9999px";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.warn('Fallback copy failed:', err);
  }
  document.body.removeChild(textArea);
}

// 3. Pricing Cards Integration
function initPricingButtons() {
  const pricingButtons = document.querySelectorAll('.select-plan-btn');
  pricingButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.getAttribute('data-plan');
      
      // Update calculator selection
      const calcRadio = document.querySelector(`input[name="calc-package"][value="${plan}"]`);
      if (calcRadio) {
        calcRadio.checked = true;
        calcRadio.dispatchEvent(new Event('change'));
      }

      // Update booking form
      const pkgSelect = document.getElementById('booking-package');
      if (pkgSelect) {
        pkgSelect.value = plan;
      }

      // Smooth scroll to calculator with toast prompt
      const calcSection = document.getElementById('calculator');
      if (calcSection) {
        calcSection.scrollIntoView({ behavior: 'smooth' });
        showToast('Тариф выбран! Нажмите «Написать в сообщения группы» для быстрой записи.', 'info');
      }
    });
  });
}

// 3.1 Mobile Pricing Quick Tabs & Snap Track Navigation
function initPricingMobileTabs() {
  const track = document.getElementById('pricing-cards-track');
  const tabs = document.querySelectorAll('.pricing-tab-btn');
  const counter = document.getElementById('pricing-counter');
  if (!track || !tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const index = parseInt(tab.getAttribute('data-index'), 10) || 0;
      const card = document.getElementById(`price-card-container-${index}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }

      tabs.forEach(t => {
        t.classList.remove('active', 'bg-accent-gold', 'text-black', 'border-accent-gold');
        t.classList.add('bg-white/5', 'text-zinc-300', 'border-white/10');
      });
      tab.classList.add('active', 'bg-accent-gold', 'text-black', 'border-accent-gold');
      tab.classList.remove('bg-white/5', 'text-zinc-300', 'border-white/10');

      if (counter) counter.textContent = `${index + 1} / 4`;
    });
  });

  // Track scroll observer to update active tab and counter on swipe
  track.addEventListener('scroll', () => {
    const scrollLeft = track.scrollLeft;
    const cardWidth = track.firstElementChild?.offsetWidth || 300;
    const activeIndex = Math.min(3, Math.max(0, Math.round(scrollLeft / cardWidth)));

    tabs.forEach((t, i) => {
      if (i === activeIndex) {
        t.classList.add('active', 'bg-accent-gold', 'text-black', 'border-accent-gold');
        t.classList.remove('bg-white/5', 'text-zinc-300', 'border-white/10');
      } else {
        t.classList.remove('active', 'bg-accent-gold', 'text-black', 'border-accent-gold');
        t.classList.add('bg-white/5', 'text-zinc-300', 'border-white/10');
      }
    });

    if (counter) counter.textContent = `${activeIndex + 1} / 4`;
  }, { passive: true });
}

// 4. Booking Form Submission & Modal
function initBookingForm() {
  const form = document.getElementById('booking-form');
  const submitBtn = document.getElementById('booking-submit-btn');
  const modal = document.getElementById('success-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalDetails = document.getElementById('modal-booking-summary');
  const waDirectBtn = document.getElementById('modal-wa-btn');

  // Set minimum date to tomorrow
  const dateInput = document.getElementById('booking-date');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('booking-name');
    const phoneInput = document.getElementById('booking-phone');
    const packageInput = document.getElementById('booking-package');
    const dateInput = document.getElementById('booking-date');
    const notesInput = document.getElementById('booking-notes');

    // Validate phone (must have at least 10 digits excluding country code)
    const rawDigits = phoneInput.value.replace(/\D/g, '');
    if (rawDigits.length < 11) {
      phoneInput.focus();
      phoneInput.classList.add('border-rose-500');
      showToast('Пожалуйста, укажите полный номер телефона', 'error');
      return;
    } else {
      phoneInput.classList.remove('border-rose-500');
    }

    // Double submit prevention
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-black inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Отправка заявки...</span>
      `;
    }

    const payload = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      package: packageInput.options[packageInput.selectedIndex].text,
      date: dateInput.value || 'Дата уточняется',
      notes: notesInput.value.trim()
    };

    // Simulate network delay / webhook dispatch
    await new Promise(r => setTimeout(r, 700));

    // Fill success modal info
    if (modalDetails) {
      modalDetails.innerHTML = `
        <div class="text-xs text-zinc-400 space-y-1">
          <div><strong class="text-zinc-200">Имя:</strong> ${payload.name}</div>
          <div><strong class="text-zinc-200">Телефон:</strong> ${payload.phone}</div>
          <div><strong class="text-zinc-200">Тариф:</strong> ${payload.package}</div>
          <div><strong class="text-zinc-200">Дата:</strong> ${payload.date}</div>
        </div>
      `;
    }

    // Prepare direct VK message
    const modalVkBtn = document.getElementById('modal-vk-btn');
    if (modalVkBtn) {
      const vkText = `Здравствуйте, Мила! Меня зовут ${payload.name}. Я оставил(а) заявку на сайте на съемку (${payload.package}, желаемая дата: ${payload.date}). Номер: ${payload.phone}${payload.notes ? '\nПожелания: ' + payload.notes : ''}`;
      modalVkBtn.href = `https://vk.com/im?sel=-240592099&message=${encodeURIComponent(vkText)}`;
      modalVkBtn.onclick = () => {
        copyTextToClipboard(vkText);
        showToast('✨ Переходим в сообщения группы ВК!', 'success');
      };
    }

    // Prepare direct WhatsApp message
    if (waDirectBtn) {
      const waText = encodeURIComponent(`Здравствуйте, Мила! Меня зовут ${payload.name}. Я оставил(а) заявку на сайте на съемку (${payload.package}, желаемая дата: ${payload.date}). Номер: ${payload.phone}`);
      waDirectBtn.href = `https://wa.me/79533286104?text=${waText}`;
    }

    // Open modal
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    form.reset();

    // Re-enable button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Забронировать дату</span>
        <i data-lucide="sparkles" class="w-4 h-4 ml-2 inline-block"></i>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  closeModalBtn?.addEventListener('click', () => {
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });
}

// 5. Toast Notification System
function showToast(message, type = 'info') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }

  const isLight = document.documentElement.classList.contains('light');

  let bgBorderText = '';
  if (type === 'error') {
    bgBorderText = isLight 
      ? 'border-rose-400 bg-rose-50 text-rose-950 shadow-rose-200/60'
      : 'border-rose-500/40 bg-rose-950/95 text-rose-200 shadow-rose-950/50';
  } else if (type === 'success') {
    bgBorderText = isLight
      ? 'border-emerald-400 bg-emerald-50 text-emerald-950 shadow-emerald-200/60'
      : 'border-emerald-500/50 bg-[#0d2217]/95 text-emerald-200 shadow-emerald-950/50';
  } else {
    bgBorderText = isLight
      ? 'border-pink-300 bg-white/95 text-[#240f26] shadow-pink-100/90'
      : 'border-accent-fairy-pink/40 bg-[#1a0c1d]/95 text-zinc-100 shadow-purple-950/50';
  }

  toast.className = `fixed bottom-6 right-6 z-[100005] px-5 py-3.5 rounded-2xl border text-xs sm:text-sm font-medium backdrop-blur-xl shadow-2xl flex items-center gap-3 max-w-sm transition-all duration-300 ${bgBorderText}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  toast.style.pointerEvents = 'auto';

  toast.innerHTML = `
    <span class="w-2.5 h-2.5 rounded-full ${type === 'error' ? 'bg-rose-500' : type === 'success' ? 'bg-emerald-500 animate-ping' : 'bg-accent-rose-gold'} shrink-0"></span>
    <span class="font-medium">${message}</span>
  `;

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
    toast.style.pointerEvents = 'none';
  }, 3200);
}

// 6. FAQ Accordion Logic
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    const content = item.querySelector('.faq-content');
    const icon = item.querySelector('.faq-icon');

    trigger?.addEventListener('click', () => {
      const isOpen = !content.classList.contains('hidden');

      // Close all others
      faqItems.forEach(other => {
        other.querySelector('.faq-content')?.classList.add('hidden');
        other.querySelector('.faq-icon')?.classList.remove('rotate-180');
      });

      if (!isOpen) {
        content.classList.remove('hidden');
        icon?.classList.add('rotate-180');
      }
    });
  });
}

// 7. Mobile Navigation Drawer
function initMobileNav() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  const links = drawer?.querySelectorAll('a');

  menuBtn?.addEventListener('click', () => {
    drawer?.classList.toggle('hidden');
  });

  links?.forEach(link => {
    link.addEventListener('click', () => {
      drawer?.classList.add('hidden');
    });
  });
}

// 8. Swiper Reviews Carousel Initialization
function initReviewsSwiper() {
  if (typeof Swiper !== 'undefined' && document.querySelector('.reviews-swiper')) {
    new Swiper('.reviews-swiper', {
      slidesPerView: 1,
      spaceBetween: 20,
      loop: true,
      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },
      pagination: {
        el: '.reviews-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.reviews-next',
        prevEl: '.reviews-prev',
      },
      breakpoints: {
        640: {
          slidesPerView: 2,
          spaceBetween: 24,
        },
        1024: {
          slidesPerView: 3,
          spaceBetween: 30,
        }
      }
    });
  }
}

// 9. Dual Theme Switcher (Dark Velvet / Light Dawn Pearl)
function initThemeSwitcher() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const mobileToggleBtn = document.getElementById('mobile-theme-toggle-btn');

  const applyTheme = (theme, showNotification = true) => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('fotofeya-theme', theme);

    // Update Lucide icons if available
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    // Synchronize Fairy Dust canvas particle palette
    if (window.fairyDustSystem) {
      window.fairyDustSystem.updateTheme(theme);
    }

    if (showNotification) {
      showToast(theme === 'light' ? '☀️ Включена светлая тема (Жемчужная роза)' : '🌙 Включена темная тема (Королевский бархат)', 'info');
    }
  };

  const toggle = () => {
    const isLight = document.documentElement.classList.contains('light');
    const targetTheme = isLight ? 'dark' : 'light';
    applyTheme(targetTheme, true);
  };

  toggleBtn?.addEventListener('click', toggle);
  mobileToggleBtn?.addEventListener('click', toggle);

  // Initial sync with Fairy Dust System if needed
  const currentTheme = document.documentElement.classList.contains('light') ? 'light' : 'dark';
  if (window.fairyDustSystem) {
    window.fairyDustSystem.updateTheme(currentTheme);
  }
}

// 10. Animated Stat Counters (CountUp)
function initStatCounters() {
  const counters = document.querySelectorAll('.stat-counter');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const targetVal = parseFloat(el.getAttribute('data-target')) || 0;
        const decimals = parseInt(el.getAttribute('data-decimals'), 10) || 0;
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';
        const duration = 1400;
        const startTime = performance.now();

        const update = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          const current = (targetVal * ease).toFixed(decimals);
          el.textContent = `${prefix}${current}${suffix}`;

          if (progress < 1) {
            requestAnimationFrame(update);
          }
        };

        requestAnimationFrame(update);
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.25 });

  counters.forEach(c => observer.observe(c));
}

// 11. Mobile Sticky Conversion Bar
function initMobileStickyBar() {
  const bar = document.getElementById('mobile-sticky-bar');
  const quickVkBtn = document.getElementById('mobile-quick-vk-btn');
  if (!bar) return;

  // Reveal when scrolled past hero section
  const handleScroll = () => {
    if (window.scrollY > 260) {
      bar.classList.remove('hide-bar');
    } else {
      bar.classList.add('hide-bar');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  quickVkBtn?.addEventListener('click', () => {
    if (window.costCalculator && typeof window.costCalculator.sendToVk === 'function') {
      window.costCalculator.sendToVk();
    } else {
      const defaultText = `Здравствуйте, Мила! Хочу узнать подробнее о сказочной фотосессии в Малоярославце.`;
      copyTextToClipboard(defaultText);
      showToast('✨ Переходим в сообщения группы ВК!', 'success');
      window.open(`https://vk.com/im?sel=-240592099&message=${encodeURIComponent(defaultText)}`, '_blank');
    }
  });
}

// 12. Secret Admin Price Manager System
const DEFAULT_PRICES = {
  packages: {
    fairy: { name: 'Сказочный образ 🧚', price: 4900, desc: 'Детский костюмированный фотопроект по созданию персональной сказки.' },
    family: { name: 'Семейная прогулка 🌾', price: 4500, desc: 'Теплые искренние кадры родителей и детей на закате или в поле.' },
    portrait: { name: 'Женский арт-портрет ✨', price: 5000, desc: 'Глубокие кинематографичные портреты, подчеркивающие вашу эстетику.' },
    express: { name: 'Экспресс / Мини-сет ⚡', price: 2900, desc: 'Быстрая фотосессия для одного образа или обновления контента.' }
  },
  duration: {
    standard: 0,
    extra30: 1500,
    extra60: 3000
  },
  addons: {
    studio: { name: 'Аренда интерьерной студии', price: 1800 },
    travel: { name: 'Выезд за город (Обнинск, Балабаново)', price: 1000 },
    express_delivery: { name: 'Экспресс-отдача фото за 48 часов', price: 1500 },
    photobook: { name: 'Премиум фотокнига 20×20 см', price: 3500 }
  }
};

class PriceManager {
  constructor() {
    this.prices = JSON.parse(JSON.stringify(DEFAULT_PRICES));
    this.secretTrigger = document.getElementById('admin-secret-trigger');
    this.authModal = document.getElementById('admin-auth-modal');
    this.authForm = document.getElementById('admin-auth-form');
    this.passwordInput = document.getElementById('admin-password-input');
    this.authCancel = document.getElementById('admin-auth-cancel');
    this.authError = document.getElementById('admin-auth-error');
    
    this.priceModal = document.getElementById('admin-price-modal');
    this.priceForm = document.getElementById('admin-price-form');
    this.priceClose = document.getElementById('admin-price-close');
    this.priceReset = document.getElementById('admin-price-reset');
    this.logoutBtn = document.getElementById('admin-logout-btn');
    
    this.floatingStatus = document.getElementById('admin-floating-status');
    this.reopenBtn = document.getElementById('admin-reopen-btn');
    this.quickExitBtn = document.getElementById('admin-quick-exit-btn');

    this.tripleClickCount = 0;
    this.tripleClickTimer = null;
    
    this.init();
  }

  async init() {
    // 1. Try local cache first for Zero-Flash hydration
    const cached = localStorage.getItem('fotofeya_prices');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        this.mergePrices(parsed);
        this.applyPricesToDOM(this.prices);
      } catch (e) {
        console.warn('Failed to parse cached prices:', e);
      }
    }

    // 2. Fetch fresh prices from backend
    await this.fetchPrices();

    // 3. Bind admin secret triggers (Keyboard, Triple-tap, Hash)
    this.bindSecretTriggers();

    // 4. Bind admin modals and actions
    this.bindModalActions();
    this.bindTabs();
    this.bindVkSync();
    this.bindManualUpload();
    document.getElementById('adm-gallery-save-btn')?.addEventListener('click', () => this.saveAdminGallery());

    // 5. Restore floating badge if admin already authenticated in this session
    if (sessionStorage.getItem('fotofeya_admin_token')) {
      this.showFloatingBadge();
    }

    // 6. Check URL hash (#admin) or query (?admin)
    if (window.location.hash === '#admin' || window.location.search.includes('admin')) {
      setTimeout(() => this.triggerAdminFlow(), 300);
    }
  }

  mergePrices(incoming) {
    if (!incoming) return;
    if (incoming.packages) {
      for (const k in incoming.packages) {
        if (this.prices.packages[k]) {
          this.prices.packages[k].price = Number(incoming.packages[k].price) || this.prices.packages[k].price;
          if (incoming.packages[k].name) this.prices.packages[k].name = incoming.packages[k].name;
        }
      }
    }
    if (incoming.duration) {
      if (incoming.duration.extra30 !== undefined) this.prices.duration.extra30 = Number(incoming.duration.extra30);
      if (incoming.duration.extra60 !== undefined) this.prices.duration.extra60 = Number(incoming.duration.extra60);
    }
    if (incoming.addons) {
      for (const k in incoming.addons) {
        if (this.prices.addons[k]) {
          this.prices.addons[k].price = Number(incoming.addons[k].price) || this.prices.addons[k].price;
          if (incoming.addons[k].name) this.prices.addons[k].name = incoming.addons[k].name;
        }
      }
    }
  }

  async fetchPrices() {
    try {
      const res = await fetch('/api/prices', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        this.mergePrices(data);
        localStorage.setItem('fotofeya_prices', JSON.stringify(this.prices));
        this.applyPricesToDOM(this.prices);
      }
    } catch (err) {
      // Offline fallback: already applied from local storage or defaults
      this.applyPricesToDOM(this.prices);
    }
  }

  formatPrice(num) {
    return Number(num).toLocaleString('ru-RU') + ' ₽';
  }

  applyPricesToDOM(prices) {
    const fmt = this.formatPrice;

    // 1. Pricing cards in #pricing (Titles & Prices)
    const tFairy = document.getElementById('price-card-title-fairy');
    const tFamily = document.getElementById('price-card-title-family');
    const tPortrait = document.getElementById('price-card-title-portrait');
    const tExpress = document.getElementById('price-card-title-express');

    if (tFairy && prices.packages.fairy.name) tFairy.textContent = prices.packages.fairy.name;
    if (tFamily && prices.packages.family.name) tFamily.textContent = prices.packages.family.name;
    if (tPortrait && prices.packages.portrait.name) tPortrait.textContent = prices.packages.portrait.name;
    if (tExpress && prices.packages.express.name) tExpress.textContent = prices.packages.express.name;

    const pFairy = document.getElementById('price-card-fairy');
    const pFamily = document.getElementById('price-card-family');
    const pPortrait = document.getElementById('price-card-portrait');
    const pExpress = document.getElementById('price-card-express');

    if (pFairy) pFairy.textContent = fmt(prices.packages.fairy.price);
    if (pFamily) pFamily.textContent = fmt(prices.packages.family.price);
    if (pPortrait) pPortrait.textContent = fmt(prices.packages.portrait.price);
    if (pExpress) pExpress.textContent = fmt(prices.packages.express.price);

    // 2. Calculator package radio titles and badges
    const cNameFairy = document.getElementById('calc-name-fairy');
    const cNameFamily = document.getElementById('calc-name-family');
    const cNamePortrait = document.getElementById('calc-name-portrait');
    const cNameExpress = document.getElementById('calc-name-express');

    if (cNameFairy && prices.packages.fairy.name) cNameFairy.textContent = prices.packages.fairy.name;
    if (cNameFamily && prices.packages.family.name) cNameFamily.textContent = prices.packages.family.name;
    if (cNamePortrait && prices.packages.portrait.name) cNamePortrait.textContent = prices.packages.portrait.name;
    if (cNameExpress && prices.packages.express.name) cNameExpress.textContent = prices.packages.express.name;

    const bFairy = document.getElementById('calc-badge-fairy');
    const bFamily = document.getElementById('calc-badge-family');
    const bPortrait = document.getElementById('calc-badge-portrait');
    const bExpress = document.getElementById('calc-badge-express');

    if (bFairy) bFairy.textContent = fmt(prices.packages.fairy.price);
    if (bFamily) bFamily.textContent = fmt(prices.packages.family.price);
    if (bPortrait) bPortrait.textContent = fmt(prices.packages.portrait.price);
    if (bExpress) bExpress.textContent = fmt(prices.packages.express.price);

    // 3. Calculator duration options
    const optExtra30 = document.getElementById('calc-opt-extra30');
    const optExtra60 = document.getElementById('calc-opt-extra60');
    if (optExtra30) optExtra30.textContent = `Продлить на 30 минут (+${fmt(prices.duration.extra30)})`;
    if (optExtra60) optExtra60.textContent = `Продлить на 1 час (+${fmt(prices.duration.extra60)})`;

    // 4. Calculator addons (names, checkboxes data-cost/data-name, and badge labels)
    const addonMap = {
      studio: { cb: 'calc-addon-cb-studio', badge: 'calc-badge-studio', label: 'calc-addon-name-studio' },
      travel: { cb: 'calc-addon-cb-travel', badge: 'calc-badge-travel', label: 'calc-addon-name-travel' },
      express_delivery: { cb: 'calc-addon-cb-express', badge: 'calc-badge-express', label: 'calc-addon-name-express' },
      photobook: { cb: 'calc-addon-cb-photobook', badge: 'calc-badge-photobook', label: 'calc-addon-name-photobook' }
    };

    for (const [key, mapping] of Object.entries(addonMap)) {
      const addon = prices.addons[key];
      if (!addon) continue;
      const cb = document.getElementById(mapping.cb);
      if (cb) {
        cb.setAttribute('data-cost', addon.price);
        if (addon.name) cb.setAttribute('data-name', addon.name);
      }
      const label = document.getElementById(mapping.label);
      if (label && addon.name) {
        label.textContent = addon.name;
      }
      const badge = document.getElementById(mapping.badge);
      if (badge) {
        badge.textContent = `+${fmt(addon.price)}`;
      }
    }

    // 5. Booking select options
    const bOptFairy = document.getElementById('booking-opt-fairy');
    const bOptFamily = document.getElementById('booking-opt-family');
    const bOptPortrait = document.getElementById('booking-opt-portrait');
    const bOptExpress = document.getElementById('booking-opt-express');

    if (bOptFairy) bOptFairy.textContent = `${prices.packages.fairy.name} (${fmt(prices.packages.fairy.price)})`;
    if (bOptFamily) bOptFamily.textContent = `${prices.packages.family.name} (${fmt(prices.packages.family.price)})`;
    if (bOptPortrait) bOptPortrait.textContent = `${prices.packages.portrait.name} (${fmt(prices.packages.portrait.price)})`;
    if (bOptExpress) bOptExpress.textContent = `${prices.packages.express.name} (${fmt(prices.packages.express.price)})`;

    // 6. Sync with CostCalculator
    if (window.costCalculator && typeof window.costCalculator.updatePrices === 'function') {
      window.costCalculator.updatePrices(prices);
    }
  }

  bindSecretTriggers() {
    // A. Keyboard shortcuts: Ctrl+Shift+P or Alt+P
    window.addEventListener('keydown', (e) => {
      const isCtrlShiftP = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p' || e.code === 'KeyP');
      const isAltP = e.altKey && (e.key === 'P' || e.key === 'p' || e.code === 'KeyP');
      if (isCtrlShiftP || isAltP) {
        e.preventDefault();
        this.triggerAdminFlow();
      }
    });

    // B. Footer copyright triple click
    if (this.secretTrigger) {
      this.secretTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        this.tripleClickCount++;
        clearTimeout(this.tripleClickTimer);
        
        if (this.tripleClickCount >= 3) {
          this.tripleClickCount = 0;
          this.triggerAdminFlow();
        } else {
          this.tripleClickTimer = setTimeout(() => {
            this.tripleClickCount = 0;
          }, 1200);
        }
      });
    }

    // C. Hash change listener
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#admin') {
        this.triggerAdminFlow();
      }
    });
  }

  triggerAdminFlow() {
    const token = sessionStorage.getItem('fotofeya_admin_token');
    if (token) {
      this.showFloatingBadge();
      this.openPriceModal();
    } else {
      this.openAuthModal();
    }
  }

  openAuthModal() {
    if (!this.authModal) return;
    this.authModal.classList.remove('hidden');
    this.authModal.classList.add('flex');
    if (this.authError) this.authError.classList.add('hidden');
    if (this.passwordInput) {
      this.passwordInput.value = '';
      setTimeout(() => this.passwordInput.focus(), 100);
    }
  }

  closeAuthModal() {
    if (!this.authModal) return;
    this.authModal.classList.add('hidden');
    this.authModal.classList.remove('flex');
    if (this.authError) this.authError.classList.add('hidden');
  }

  openPriceModal() {
    if (!this.priceModal) return;
    this.populateEditorForm();
    this.priceModal.classList.remove('hidden');
    this.priceModal.classList.add('flex');
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  closePriceModal() {
    if (!this.priceModal) return;
    this.priceModal.classList.add('hidden');
    this.priceModal.classList.remove('flex');
  }

  showFloatingBadge() {
    if (this.floatingStatus) {
      this.floatingStatus.classList.remove('hidden');
      this.floatingStatus.classList.add('flex');
    }
  }

  hideFloatingBadge() {
    if (this.floatingStatus) {
      this.floatingStatus.classList.add('hidden');
      this.floatingStatus.classList.remove('flex');
    }
  }

  populateEditorForm() {
    const f = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };
    // Packages (Names & Prices)
    f('adm-name-fairy', this.prices.packages.fairy.name);
    f('adm-price-fairy', this.prices.packages.fairy.price);

    f('adm-name-family', this.prices.packages.family.name);
    f('adm-price-family', this.prices.packages.family.price);

    f('adm-name-portrait', this.prices.packages.portrait.name);
    f('adm-price-portrait', this.prices.packages.portrait.price);

    f('adm-name-express', this.prices.packages.express.name);
    f('adm-price-express', this.prices.packages.express.price);

    // Duration
    f('adm-extra-30', this.prices.duration.extra30);
    f('adm-extra-60', this.prices.duration.extra60);

    // Addons (Names & Prices)
    f('adm-addon-name-studio', this.prices.addons.studio.name);
    f('adm-addon-studio', this.prices.addons.studio.price);

    f('adm-addon-name-travel', this.prices.addons.travel.name);
    f('adm-addon-travel', this.prices.addons.travel.price);

    f('adm-addon-name-express', this.prices.addons.express_delivery.name);
    f('adm-addon-express', this.prices.addons.express_delivery.price);

    f('adm-addon-name-photobook', this.prices.addons.photobook.name);
    f('adm-addon-photobook', this.prices.addons.photobook.price);
  }

  bindModalActions() {
    // Auth cancel
    this.authCancel?.addEventListener('click', () => {
      this.closeAuthModal();
      if (window.location.hash === '#admin') {
        history.replaceState(null, null, ' ');
      }
    });

    // Auth backdrop click
    this.authModal?.addEventListener('click', (e) => {
      if (e.target === this.authModal) {
        this.closeAuthModal();
      }
    });

    // Auth submit
    this.authForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enteredPassword = this.passwordInput?.value?.trim() || '';
      
      // Verify password by testing against backend /api/prices
      let isValid = false;
      try {
        const testRes = await fetch('/api/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: enteredPassword, prices: this.prices })
        });
        if (testRes.status === 200) {
          isValid = true;
        } else if (testRes.status === 401) {
          isValid = false;
        } else {
          // If server returned another status, test fallback
          isValid = (enteredPassword === 'mila2026');
        }
      } catch (err) {
        // Offline / file:// protocol fallback
        isValid = (enteredPassword === 'mila2026');
      }

      if (isValid) {
        sessionStorage.setItem('fotofeya_admin_token', enteredPassword);
        this.closeAuthModal();
        this.showFloatingBadge();
        this.openPriceModal();
        showToast('✨ Доступ разрешен! Открыт редактор прайса.', 'success');
        if (window.location.hash === '#admin') {
          history.replaceState(null, null, ' ');
        }
      } else {
        if (this.authError) {
          this.authError.classList.remove('hidden');
          this.passwordInput?.classList.add('border-rose-500');
          setTimeout(() => this.passwordInput?.classList.remove('border-rose-500'), 1500);
        }
      }
    });

    // Price modal close
    this.priceClose?.addEventListener('click', () => this.closePriceModal());
    this.priceModal?.addEventListener('click', (e) => {
      if (e.target === this.priceModal) this.closePriceModal();
    });

    // Reopen price modal from floating status
    this.reopenBtn?.addEventListener('click', () => this.openPriceModal());

    // Quick exit from floating status
    this.quickExitBtn?.addEventListener('click', () => this.logout());

    // Logout button in modal
    this.logoutBtn?.addEventListener('click', () => {
      this.closePriceModal();
      this.logout();
    });

    // Reset to defaults
    this.priceReset?.addEventListener('click', () => {
      if (confirm('Сбросить все цены к первоначальным базовым значениям?')) {
        this.prices = JSON.parse(JSON.stringify(DEFAULT_PRICES));
        this.populateEditorForm();
        showToast('Цены в форме сброшены к базовым. Нажмите «Сохранить прайс».', 'info');
      }
    });

    // Price save form submission
    this.priceForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.savePrices();
    });
  }

  async savePrices() {
    const saveBtn = document.getElementById('admin-price-save');
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span>Сохранение...</span>`;
    }

    const gVal = (id, fallback) => {
      const el = document.getElementById(id);
      const v = parseInt(el?.value, 10);
      return isNaN(v) ? fallback : v;
    };

    const gName = (id, fallback) => {
      const el = document.getElementById(id);
      const v = el?.value?.trim();
      return v ? v : fallback;
    };

    const updated = {
      packages: {
        fairy: {
          ...this.prices.packages.fairy,
          name: gName('adm-name-fairy', this.prices.packages?.fairy?.name || 'Сказочный образ 🧚'),
          price: gVal('adm-price-fairy', 4900)
        },
        family: {
          ...this.prices.packages.family,
          name: gName('adm-name-family', this.prices.packages?.family?.name || 'Семейная прогулка 🌾'),
          price: gVal('adm-price-family', 4500)
        },
        portrait: {
          ...this.prices.packages.portrait,
          name: gName('adm-name-portrait', this.prices.packages?.portrait?.name || 'Женский арт-портрет ✨'),
          price: gVal('adm-price-portrait', 5000)
        },
        express: {
          ...this.prices.packages.express,
          name: gName('adm-name-express', this.prices.packages?.express?.name || 'Экспресс / Мини-сет ⚡'),
          price: gVal('adm-price-express', 2900)
        }
      },
      duration: {
        standard: 0,
        extra30: gVal('adm-extra-30', 1500),
        extra60: gVal('adm-extra-60', 3000)
      },
      addons: {
        studio: {
          ...this.prices.addons.studio,
          name: gName('adm-addon-name-studio', this.prices.addons?.studio?.name || 'Аренда интерьерной студии'),
          price: gVal('adm-addon-studio', 1800)
        },
        travel: {
          ...this.prices.addons.travel,
          name: gName('adm-addon-name-travel', this.prices.addons?.travel?.name || 'Выезд за пределы города (>15 км)'),
          price: gVal('adm-addon-travel', 1000)
        },
        express_delivery: {
          ...this.prices.addons.express_delivery,
          name: gName('adm-addon-name-express', this.prices.addons?.express_delivery?.name || 'Срочная отдача за 48 часов'),
          price: gVal('adm-addon-express', 1500)
        },
        photobook: {
          ...this.prices.addons.photobook,
          name: gName('adm-addon-name-photobook', this.prices.addons?.photobook?.name || 'Премиум фотокнига (20x20 см, 10 разворотов)'),
          price: gVal('adm-addon-photobook', 3500)
        }
      },
      lastUpdated: new Date().toISOString()
    };

    const token = sessionStorage.getItem('fotofeya_admin_token') || 'mila2026';
    let savedOnServer = false;

    try {
      const res = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: token, prices: updated })
      });

      if (res.ok) {
        savedOnServer = true;
      } else if (res.status === 401) {
        showToast('Ошибка авторизации. Войдите заново.', 'error');
        this.logout();
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalText;
        }
        return;
      }
    } catch (err) {
      console.warn('Backend not reachable, saving to local storage fallback', err);
    }

    // Update state & localStorage
    this.prices = updated;
    localStorage.setItem('fotofeya_prices', JSON.stringify(updated));

    // Update DOM across entire site immediately
    this.applyPricesToDOM(updated);

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }

    this.closePriceModal();

    if (savedOnServer) {
      showToast('🎉 Прайс-лист успешно обновлен на сервере и виден всем!', 'success');
    } else {
      showToast('✅ Прайс-лист сохранен локально!', 'success');
    }
  }

  bindTabs() {
    this.tabPrices = document.getElementById('admin-tab-prices');
    this.tabGallery = document.getElementById('admin-tab-gallery');
    this.galleryView = document.getElementById('admin-gallery-view');

    this.tabPrices?.addEventListener('click', () => this.switchTab('prices'));
    this.tabGallery?.addEventListener('click', () => this.switchTab('gallery'));
  }

  switchTab(tab) {
    this.activeTab = tab;
    if (tab === 'prices') {
      this.tabPrices?.classList.add('bg-accent-gold', 'text-black', 'shadow-md');
      this.tabPrices?.classList.remove('bg-white/5', 'text-zinc-300');
      this.tabGallery?.classList.remove('bg-accent-gold', 'text-black', 'shadow-md');
      this.tabGallery?.classList.add('bg-white/5', 'text-zinc-300');

      this.priceForm?.classList.remove('hidden');
      this.galleryView?.classList.add('hidden');
    } else {
      this.tabGallery?.classList.add('bg-accent-gold', 'text-black', 'shadow-md');
      this.tabGallery?.classList.remove('bg-white/5', 'text-zinc-300');
      this.tabPrices?.classList.remove('bg-accent-gold', 'text-black', 'shadow-md');
      this.tabPrices?.classList.add('bg-white/5', 'text-zinc-300');

      this.priceForm?.classList.add('hidden');
      this.galleryView?.classList.remove('hidden');

      this.loadAdminGallery();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  async loadAdminGallery() {
    const listEl = document.getElementById('adm-gallery-items-list');
    if (!listEl) return;
    listEl.innerHTML = `<div class="p-4 text-center text-xs text-zinc-400">Загрузка фотографий...</div>`;

    try {
      const res = await fetch('/api/portfolio?all=1&t=' + Date.now());
      if (res.ok) {
        this.adminPortfolioItems = await res.json();
      } else {
        this.adminPortfolioItems = window.portfolioManager?.portfolioItems || [];
      }
    } catch (e) {
      this.adminPortfolioItems = window.portfolioManager?.portfolioItems || [];
    }
    this.renderAdminGalleryList();
  }

  renderAdminGalleryList() {
    const listEl = document.getElementById('adm-gallery-items-list');
    if (!listEl) return;

    if (!Array.isArray(this.adminPortfolioItems) || this.adminPortfolioItems.length === 0) {
      listEl.innerHTML = `<div class="p-6 text-center text-xs text-zinc-400 border border-dashed border-white/10 rounded-2xl">В галерее пока нет фотографий. Добавьте новые через VK или файл выше.</div>`;
      return;
    }

    const catBadge = {
      fairy: '🧚 Сказочные',
      family: '🌾 Семейные',
      autumn: '🍁 Осенние',
      portrait: '✨ Портреты'
    };

    listEl.innerHTML = this.adminPortfolioItems.map((item, idx) => {
      const isActive = item.isActive !== false;
      return `
        <div class="p-3 rounded-2xl bg-surface border ${isActive ? 'border-white/10' : 'border-white/5 opacity-60'} flex items-center justify-between gap-3 group transition-all" data-idx="${idx}">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-14 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10 relative">
              <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover" onerror="this.src='assets/images/logo.png'" />
            </div>
            <div class="min-w-0">
              <h5 class="text-xs font-semibold text-white truncate">${item.title}</h5>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-accent-fairy-pink/15 text-accent-fairy-pink font-medium">
                  ${catBadge[item.category] || item.categoryLabel || item.category}
                </span>
                <span class="text-[10px] ${isActive ? 'text-emerald-400' : 'text-zinc-500'} font-medium">
                  ${isActive ? '● На главной' : '○ Скрыто'}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button type="button" class="adm-photo-move-up p-1.5 rounded-lg btn-ghost text-zinc-400 hover:text-white" title="Поднять выше" data-idx="${idx}">
              <i data-lucide="chevron-up" class="w-4 h-4"></i>
            </button>
            <button type="button" class="adm-photo-move-down p-1.5 rounded-lg btn-ghost text-zinc-400 hover:text-white" title="Опустить ниже" data-idx="${idx}">
              <i data-lucide="chevron-down" class="w-4 h-4"></i>
            </button>
            <button type="button" class="adm-photo-toggle-vis p-1.5 rounded-lg btn-ghost ${isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'}" title="${isActive ? 'Скрыть с главной' : 'Показать на главной'}" data-idx="${idx}">
              <i data-lucide="${isActive ? 'eye' : 'eye-off'}" class="w-4 h-4"></i>
            </button>
            <button type="button" class="adm-photo-delete p-1.5 rounded-lg btn-ghost text-zinc-400 hover:text-rose-400" title="Удалить" data-idx="${idx}">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind item actions
    listEl.querySelectorAll('.adm-photo-move-up').forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        if (i > 0) {
          const temp = this.adminPortfolioItems[i];
          this.adminPortfolioItems[i] = this.adminPortfolioItems[i - 1];
          this.adminPortfolioItems[i - 1] = temp;
          this.renderAdminGalleryList();
        }
      });
    });

    listEl.querySelectorAll('.adm-photo-move-down').forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        if (i < this.adminPortfolioItems.length - 1) {
          const temp = this.adminPortfolioItems[i];
          this.adminPortfolioItems[i] = this.adminPortfolioItems[i + 1];
          this.adminPortfolioItems[i + 1] = temp;
          this.renderAdminGalleryList();
        }
      });
    });

    listEl.querySelectorAll('.adm-photo-toggle-vis').forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        const item = this.adminPortfolioItems[i];
        if (item) {
          item.isActive = (item.isActive === false);
          this.renderAdminGalleryList();
        }
      });
    });

    listEl.querySelectorAll('.adm-photo-delete').forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        if (confirm(`Удалить фотоработу «${this.adminPortfolioItems[i]?.title}»?`)) {
          this.adminPortfolioItems.splice(i, 1);
          this.renderAdminGalleryList();
          showToast('Фотография удалена из списка. Нажмите «Сохранить галерею».', 'info');
        }
      });
    });
  }

  async saveAdminGallery() {
    const saveBtn = document.getElementById('adm-gallery-save-btn');
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span>Сохранение...</span>`;
    }

    const token = sessionStorage.getItem('fotofeya_admin_token') || 'mila2026';
    let saved = false;

    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: token, items: this.adminPortfolioItems })
      });
      if (res.ok) {
        saved = true;
      }
    } catch (err) {
      console.warn('Portfolio save fallback', err);
    }

    // Always update local cache & live manager
    localStorage.setItem('fotofeya_portfolio', JSON.stringify(this.adminPortfolioItems));
    if (window.portfolioManager) {
      window.portfolioManager.setPortfolioData(this.adminPortfolioItems.filter(i => i.isActive !== false));
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }

    if (saved) {
      showToast('🎉 Галерея успешно обновлена на сервере и видна всем!', 'success');
    } else {
      showToast('✅ Галерея обновлена локально!', 'success');
    }
  }

  bindVkSync() {
    const tokenInput = document.getElementById('adm-vk-token');
    const urlInput = document.getElementById('adm-vk-url');
    const fetchBtn = document.getElementById('adm-vk-fetch-btn');
    const resultsContainer = document.getElementById('adm-vk-results-container');
    const resultsCount = document.getElementById('adm-vk-results-count');
    const photosGrid = document.getElementById('adm-vk-photos-grid');
    const importBtn = document.getElementById('adm-vk-import-selected');
    const batchCat = document.getElementById('adm-vk-batch-category');

    // Restore saved token
    const savedToken = localStorage.getItem('fotofeya_vk_token');
    if (savedToken && tokenInput) tokenInput.value = savedToken;

    fetchBtn?.addEventListener('click', async () => {
      const token = tokenInput?.value?.trim() || '';
      const albumUrl = urlInput?.value?.trim() || '';
      const adminPass = sessionStorage.getItem('fotofeya_admin_token') || 'mila2026';

      if (!token) {
        showToast('Пожалуйста, укажите сервисный токен VK для запроса к API', 'error');
        tokenInput?.focus();
        return;
      }

      localStorage.setItem('fotofeya_vk_token', token);

      fetchBtn.disabled = true;
      fetchBtn.innerHTML = `<span>Синхронизация...</span>`;

      try {
        const res = await fetch('/api/portfolio/sync-vk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: adminPass, albumUrl, vkToken: token })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          this.fetchedVkPhotos = data.photos || [];
          if (resultsContainer) resultsContainer.classList.remove('hidden');
          if (resultsCount) resultsCount.textContent = `Найдено фото в VK: ${this.fetchedVkPhotos.length}`;

          if (photosGrid) {
            photosGrid.innerHTML = this.fetchedVkPhotos.map((p, idx) => `
              <div class="relative rounded-xl overflow-hidden bg-surface border border-white/10 group aspect-[3/4]">
                <img src="${p.imageUrl}" alt="${p.text || 'VK Photo'}" class="w-full h-full object-cover" />
                <label class="absolute top-2 left-2 z-10 cursor-pointer flex items-center justify-center w-6 h-6 rounded-lg bg-black/70 border border-white/30 text-white">
                  <input type="checkbox" class="adm-vk-cb w-4 h-4 accent-amber-400 cursor-pointer" data-idx="${idx}" ${idx < 6 ? 'checked' : ''} />
                </label>
                <div class="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent text-[10px] text-zinc-300 truncate">
                  ${p.text ? p.text : 'Фото #' + (idx + 1)}
                </div>
              </div>
            `).join('');
          }
          if (data.warning) {
            showToast(data.warning, 'info');
          } else {
            showToast(`✨ Загружено ${this.fetchedVkPhotos.length} фотографий из ВКонтакте!`, 'success');
          }
        } else {
          showToast(data.error || 'Ошибка синхронизации с VK', 'error');
        }
      } catch (err) {
        showToast('Ошибка сетевого соединения с сервером', 'error');
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Загрузить фото из VK</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    });

    importBtn?.addEventListener('click', async () => {
      const checkboxes = document.querySelectorAll('.adm-vk-cb:checked');
      if (checkboxes.length === 0) {
        showToast('Выберите хотя бы одно фото для импорта', 'info');
        return;
      }

      const selectedCategory = batchCat?.value || 'fairy';
      const catLabels = {
        fairy: 'Сказочные образы',
        family: 'Детские & Семейные',
        autumn: 'Осенние истории',
        portrait: 'Женский арт-портрет'
      };

      let nextId = this.adminPortfolioItems.length > 0 
        ? Math.max(...this.adminPortfolioItems.map(p => Number(p.id) || 0)) + 1 
        : 1;

      const imported = [];
      checkboxes.forEach(cb => {
        const idx = Number(cb.dataset.idx);
        const p = this.fetchedVkPhotos[idx];
        if (p) {
          imported.push({
            id: nextId++,
            title: p.text ? p.text.slice(0, 60) : `Фотосессия Фотофеи #${nextId}`,
            category: selectedCategory,
            categoryLabel: catLabels[selectedCategory],
            image: p.imageUrl,
            description: p.text || 'Авторская работа фотографа Милы Цвор',
            isActive: true,
            sortOrder: 0,
            dateAdded: p.date || new Date().toISOString()
          });
        }
      });

      this.adminPortfolioItems.unshift(...imported);
      await this.saveAdminGallery();
      this.renderAdminGalleryList();
      if (resultsContainer) resultsContainer.classList.add('hidden');
      showToast(`🎉 Импортировано ${imported.length} новых фото в галерею!`, 'success');
    });
  }

  bindManualUpload() {
    const fileInput = document.getElementById('adm-upload-file');
    const urlInput = document.getElementById('adm-upload-url');
    const titleInput = document.getElementById('adm-upload-title');
    const catInput = document.getElementById('adm-upload-cat');
    const descInput = document.getElementById('adm-upload-desc');
    const submitBtn = document.getElementById('adm-upload-submit-btn');

    submitBtn?.addEventListener('click', async () => {
      const file = fileInput?.files?.[0];
      const imageUrl = urlInput?.value?.trim();
      const title = titleInput?.value?.trim() || 'Новая фоторабота';
      const category = catInput?.value || 'fairy';
      const description = descInput?.value?.trim() || '';
      const adminPass = sessionStorage.getItem('fotofeya_admin_token') || 'mila2026';

      if (!file && !imageUrl) {
        showToast('Пожалуйста, выберите файл на устройстве или вставьте ссылку на фото', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Загрузка...</span>`;

      try {
        let base64 = null;
        if (file) {
          base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        const res = await fetch('/api/portfolio/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: adminPass,
            base64,
            imageUrl,
            title,
            category,
            description
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast('🎉 Фоторабота успешно добавлена в галерею!', 'success');
          if (fileInput) fileInput.value = '';
          if (urlInput) urlInput.value = '';
          if (titleInput) titleInput.value = '';
          if (descInput) descInput.value = '';

          await this.loadAdminGallery();
          if (window.portfolioManager) {
            window.portfolioManager.reloadPortfolio();
          }
        } else {
          showToast(data.error || 'Ошибка загрузки фото', 'error');
        }
      } catch (err) {
        showToast('Сбой отправки данных на сервер', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="plus-circle" class="w-3.5 h-3.5"></i><span>Опубликовать в галерее</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  logout() {
    sessionStorage.removeItem('fotofeya_admin_token');
    this.hideFloatingBadge();
    this.closePriceModal();
    this.closeAuthModal();
    showToast('Сессия администратора завершена', 'info');
  }
}

// Initialize everything on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initPhoneMask();
  initThemeSwitcher();
  window.costCalculator = new CostCalculator();
  window.priceManager = new PriceManager();
  initPricingButtons();
  initPricingMobileTabs();
  initBookingForm();
  initFaqAccordion();
  initMobileNav();
  initReviewsSwiper();
  initStatCounters();
  initMobileStickyBar();
});

