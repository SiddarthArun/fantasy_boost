// Position themes — one accent per position
const POSITION_THEMES = {
    qb: {
        label: 'Quarterbacks',
        abbr: 'QB',
        accent: '#818cf8',      // indigo-400
        accentSoft: 'rgba(99, 102, 241, 0.12)',
        accentBorder: 'rgba(99, 102, 241, 0.35)',
        posBadgeBg: 'rgba(99, 102, 241, 0.10)',
        barGradient: 'linear-gradient(90deg, #6366f1, #818cf8)',
    },
    rb: {
        label: 'Running Backs',
        abbr: 'RB',
        accent: '#fbbf24',      // amber-400
        accentSoft: 'rgba(245, 158, 11, 0.12)',
        accentBorder: 'rgba(245, 158, 11, 0.35)',
        posBadgeBg: 'rgba(245, 158, 11, 0.10)',
        barGradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    },
    wr: {
        label: 'Wide Receivers',
        abbr: 'WR',
        accent: '#34d399',      // emerald-400
        accentSoft: 'rgba(16, 185, 129, 0.12)',
        accentBorder: 'rgba(16, 185, 129, 0.35)',
        posBadgeBg: 'rgba(16, 185, 129, 0.10)',
        barGradient: 'linear-gradient(90deg, #10b981, #34d399)',
    },
    te: {
        label: 'Tight Ends',
        abbr: 'TE',
        accent: '#fb7185',      // rose-400
        accentSoft: 'rgba(244, 63, 94, 0.12)',
        accentBorder: 'rgba(244, 63, 94, 0.35)',
        posBadgeBg: 'rgba(244, 63, 94, 0.10)',
        barGradient: 'linear-gradient(90deg, #f43f5e, #fb7185)',
    },
};

// Standard fantasy lineup order
const POSITION_ORDER = ['qb', 'rb', 'wr', 'te'];

let DATA = null;
let ACTIVE_POSITION = 'qb';

// --- Boot -------------------------------------------------------------------

async function fetchAndRender() {
    try {
        const response = await fetch('../projections.json');
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
            '<p class="text-red-400 col-span-full text-center py-12">Error loading projections.</p>';
    }
}

// --- Tabs -------------------------------------------------------------------

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
                    class="pos-tab inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full border font-display font-semibold text-sm sm:text-base tracking-wider uppercase"
                    style="${tabStyle(theme, isActive)}"
                    onclick="setActivePosition('${key}')">
                    <span class="w-1.5 h-1.5 rounded-full" style="background: ${theme.accent};"></span>
                    ${theme.abbr}
                </button>
            `;
        }).join('');
}

function tabStyle(theme, isActive) {
    if (isActive) {
        return `background: ${theme.posBadgeBg}; color: ${theme.accent}; border-color: ${theme.accentBorder}; box-shadow: 0 0 0 1px ${theme.accentBorder}, 0 8px 24px -12px ${theme.accentSoft};`;
    }
    return `background: rgba(28, 25, 23, 0.5); color: rgb(168, 162, 158); border-color: rgba(41, 37, 36, 0.8);`;
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
    badge.style.background = theme.posBadgeBg;
    badge.style.color = theme.accent;
    badge.style.border = `1px solid ${theme.accentBorder}`;

    const title = document.getElementById('pos-title');
    title.textContent = theme.label;
    title.style.color = '#ffffff';

    document.getElementById('pos-count').textContent = `Top ${players.length}`;

    // Render cards
    const ceiling = Math.max(...players.map(p => p.projection)) * 1.05 || 30;
    const content = document.getElementById('content');
    content.innerHTML = players
        .map((p, i) => renderCard(p, i, ceiling, theme))
        .join('');
}

function renderCard(player, index, ceiling, theme) {
    const rank = index + 1;
    const pct = Math.max(6, Math.min(100, (player.projection / ceiling) * 100));
    const name = formatName(player.player_name);
    const initials = getInitials(player.player_name);
    const isTopThree = rank <= 3;
    const rankOpacity = isTopThree ? '1' : '0.35';
    const animationDelay = Math.min(index, 12) * 25; // cap stagger so big lists feel snappy

    return `
        <article class="fade-up group relative bg-gradient-to-br from-stone-900/80 to-stone-950/80 rounded-xl border border-stone-800/80 transition-all duration-200 ease-out hover:-translate-y-0.5 overflow-hidden"
                 style="--ring-color: ${theme.accent}; animation-delay: ${animationDelay}ms;"
                 onmouseenter="this.style.borderColor='${theme.accent}'; this.style.boxShadow='0 12px 32px -12px ${theme.accentSoft}, 0 0 0 1px ${theme.accentBorder}'"
                 onmouseleave="this.style.borderColor=''; this.style.boxShadow=''">

            <!-- Left accent stripe -->
            <div class="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 group-hover:w-1.5"
                 style="background: linear-gradient(180deg, ${theme.accent} 0%, ${theme.accent}66 100%);"></div>

            <!-- Relative projection bar (bottom edge) -->
            <div class="absolute inset-x-0 bottom-0 h-[5px] bg-stone-900/60">
                <div class="h-full transition-[width] duration-700 ease-out"
                     style="width: ${pct.toFixed(1)}%; background: ${theme.barGradient}; box-shadow: 0 0 12px ${theme.accent}80;"></div>
            </div>

            <!-- Card content -->
            <div class="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 pl-4 sm:pl-5">

                <!-- Rank -->
                <div class="flex-shrink-0 w-9 sm:w-10 text-center select-none">
                    <span class="font-display font-bold text-3xl sm:text-4xl leading-none tabular"
                          style="color: ${theme.accent}; opacity: ${rankOpacity}; text-shadow: 0 2px 8px ${theme.accent}33;">
                        ${rank}
                    </span>
                </div>

                <!-- Headshot -->
                <div class="relative flex-shrink-0">
                    <div class="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-60 blur-md transition-opacity duration-300"
                         style="background: ${theme.accent};"></div>
                    <img src="${player.headshot_url}"
                         alt="${name}"
                         loading="lazy"
                         class="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover bg-stone-800 ring-2 ring-stone-700 group-hover:ring-[3px] transition-all duration-300"
                         style="--tw-ring-color: ${theme.accent};"
                         onerror="this.replaceWith(makeFallback('${initials}', '${theme.accent}'))">
                </div>

                <!-- Name + Matchup -->
                <div class="flex-grow min-w-0 flex flex-col gap-1.5">
                    <h3 class="font-semibold text-stone-50 text-sm sm:text-base truncate tracking-tight">
                        ${name}
                    </h3>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 bg-stone-800/70 border border-stone-700/70 text-stone-300 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full">
                            <span class="text-stone-500 font-normal normal-case tracking-normal text-[9px]">vs</span>
                            <span class="tabular">${player.next_opponent}</span>
                        </span>
                    </div>
                </div>

                <!-- Projection -->
                <div class="flex-shrink-0 text-right">
                    <div class="font-display font-bold text-2xl sm:text-3xl text-white leading-none tabular tracking-tight"
                         style="text-shadow: 0 0 24px ${theme.accent}55;">
                        ${player.projection.toFixed(1)}
                    </div>
                    <div class="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-semibold mt-1">
                        pts
                    </div>
                </div>
            </div>
        </article>
    `;
}

// --- Helpers ----------------------------------------------------------------

function formatName(raw) {
    // Data is like "P.Nacua" -> "P. Nacua". Also normalize "Ty.Johnson" etc.
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

// Global helper accessible from inline onerror handlers
window.makeFallback = function(initials, color) {
    const div = document.createElement('div');
    div.className = 'relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-stone-800 ring-2 ring-stone-700 flex items-center justify-center font-display font-bold text-base sm:text-lg text-stone-400';
    div.style.color = color;
    div.textContent = initials;
    return div;
};

window.setActivePosition = setActivePosition;

fetchAndRender();
