// Position themes — Apple HIG palette with distinct accent and glow colors per position
const POSITION_THEMES = {
    wr: {
        label: 'Wide Receivers',
        abbr: 'WR',
        accent: '#30d158',      // Apple Mint Green
        accentGlow: 'rgba(48, 209, 88, 0.3)',
    },
    rb: {
        label: 'Running Backs',
        abbr: 'RB',
        accent: '#ffd60a',      // Apple Gold / Amber
        accentGlow: 'rgba(255, 214, 10, 0.3)',
    },
    qb: {
        label: 'Quarterbacks',
        abbr: 'QB',
        accent: '#0a84ff',      // Apple Blue
        accentGlow: 'rgba(10, 132, 255, 0.3)',
    },
    te: {
        label: 'Tight Ends',
        abbr: 'TE',
        accent: '#5e5ce6',      // Apple Indigo / Purple
        accentGlow: 'rgba(94, 92, 230, 0.3)',
    },
};

// Standard fantasy lineup order, with WR default as requested
const POSITION_ORDER = ['wr', 'rb', 'qb', 'te'];

let DATA = null;
let ACTIVE_POSITION = 'wr'; // Default to Wide Receivers per user request

// --- Boot -------------------------------------------------------------------

async function fetchAndRender() {
    try {
        const response = await fetch('./projections.json');
        const data = await response.json();
        DATA = data;

        if (data.generated_at) {
            const date = new Date(data.generated_at);
            const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
            document.getElementById('updated-date').textContent = date.toLocaleString('en-US', opts);
        }

        renderTabs();
        renderActive();
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('content').innerHTML =
            '<div class="apple-glass p-8 rounded-3xl col-span-full text-center text-red-400 font-medium">Failed to load projections.</div>';
    }
}

// --- Tabs (Apple Segmented Control style) ----------------------------------

function renderTabs() {
    const tabsEl = document.getElementById('position-tabs');
    tabsEl.innerHTML = POSITION_ORDER
        .filter(key => DATA && Array.isArray(DATA[key]) && DATA[key].length > 0)
        .map(key => {
            const theme = POSITION_THEMES[key];
            const isActive = key === ACTIVE_POSITION;
            return `
                <button
                    type="button"
                    role="tab"
                    aria-selected="${isActive}"
                    data-pos="${key}"
                    class="apple-pill px-5 py-2.5 rounded-2xl font-semibold text-sm tracking-wide inline-flex items-center gap-2.5 ${isActive ? 'active' : 'text-[#86868b]'}"
                    onclick="setActivePosition('${key}')">
                    <span class="w-2 h-2 rounded-full" style="background: ${theme.accent}; box-shadow: 0 0 10px ${theme.accent};"></span>
                    ${theme.label}
                </button>
            `;
        }).join('');
}

function setActivePosition(key) {
    if (!POSITION_THEMES[key] || key === ACTIVE_POSITION) return;
    ACTIVE_POSITION = key;
    renderTabs();
    renderActive();
}

// --- Content ----------------------------------------------------------------

function renderActive() {
    const theme = POSITION_THEMES[ACTIVE_POSITION];
    const players = DATA[ACTIVE_POSITION] || [];

    // Update title strip
    const badge = document.getElementById('pos-badge');
    badge.textContent = theme.abbr;
    badge.style.color = theme.accent;

    const title = document.getElementById('pos-title');
    title.textContent = theme.label;

    // Render Apple Widget Cards
    const content = document.getElementById('content');
    content.innerHTML = players
        .map((p, i) => renderAppleCard(p, i, theme))
        .join('');
}

function renderAppleCard(player, index, theme) {
    const rank = index + 1;
    const name = formatName(player.player_name);
    const initials = getInitials(player.player_name);
    const animationDelay = Math.min(index, 15) * 35;

    return `
        <article class="animate-fade-in apple-glass rounded-3xl p-4 sm:p-6 relative overflow-hidden flex flex-col justify-between group"
                 style="animation-delay: ${animationDelay}ms;">
            
            <!-- Top row: Rank & Points -->
            <div class="flex items-center justify-between mb-4 sm:mb-5">
                <span class="font-bold text-base sm:text-lg tabular px-2.5 sm:px-3 py-1 rounded-xl bg-white/5 border border-white/10"
                      style="color: ${theme.accent};">
                    #${String(rank).padStart(2, '0')}
                </span>

                <div class="text-right">
                    <div class="font-bold text-2xl sm:text-4xl text-white tracking-tight tabular leading-none"
                         style="text-shadow: 0 0 25px ${theme.accentGlow};">
                        ${player.projection.toFixed(1)}
                    </div>
                    <div class="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#86868b] font-medium mt-1">
                        Est. Points
                    </div>
                </div>
            </div>

            <!-- Middle: Headshot & Details -->
            <div class="flex items-center gap-4 sm:gap-5">
                <div class="relative flex-shrink-0">
                    <div class="absolute -inset-2 rounded-3xl opacity-30 group-hover:opacity-70 blur-xl transition-opacity duration-300"
                         style="background: ${theme.accent};"></div>
                    <img src="${player.headshot_url}"
                         alt="${name}"
                         loading="lazy"
                         class="relative w-16 h-16 sm:w-24 sm:h-24 rounded-2xl object-cover bg-neutral-900 border border-white/10 shadow-lg group-hover:scale-105 transition-transform duration-300"
                         style="-webkit-backface-visibility: hidden; transform: translateZ(0); image-rendering: -webkit-optimize-contrast;"
                         onerror="this.replaceWith(makeAppleFallback('${initials}', '${theme.accent}'))">
                </div>

                <div class="flex-grow min-w-0">
                    <h3 class="font-bold text-white text-base sm:text-xl truncate tracking-tight mb-1.5 sm:mb-2 group-hover:text-green-400 transition-colors">
                        ${name}
                    </h3>
                    <div class="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/5 border border-white/10">
                        <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#86868b] font-medium">vs</span>
                        <span class="text-xs font-semibold text-white uppercase tracking-wider tabular">
                            ${player.next_opponent}
                        </span>
                    </div>
                </div>
            </div>
        </article>
    `;
}

// --- Helpers ----------------------------------------------------------------

function formatName(raw) {
    if (!raw) return '';
    return raw
        .replace(/\./g, '. ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/^([A-Z])\. ?/, '$1. ');
}

function getInitials(raw) {
    if (!raw) return '?';
    const parts = raw.split('.');
    const letters = parts.filter(p => p.length > 0).map(p => p[0].toUpperCase());
    return letters.slice(0, 2).join('') || '?';
}

window.makeAppleFallback = function(initials, color) {
    const div = document.createElement('div');
    div.className = 'relative w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center font-bold text-xl sm:text-2xl text-neutral-300 shadow-lg';
    div.style.color = color;
    div.textContent = initials;
    return div;
};

window.setActivePosition = setActivePosition;

fetchAndRender();
