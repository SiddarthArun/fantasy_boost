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
        <article class="animate-fade-in apple-glass rounded-3xl p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between group"
                 style="animation-delay: ${animationDelay}ms;">
            
            <!-- Top row: Rank & Points -->
            <div class="flex items-center justify-between mb-4 sm:mb-5">
                <span class="font-bold text-sm sm:text-lg tabular px-2.5 sm:px-3 py-1 rounded-xl bg-white/5 border border-white/10"
                      style="color: ${theme.accent};">
                    #${String(rank).padStart(2, '0')}
                </span>

                <div class="text-right">
                    <div class="font-bold text-3xl sm:text-4xl text-white tracking-tight tabular leading-none"
                         style="text-shadow: 0 0 25px ${theme.accentGlow};">
                        ${player.projection.toFixed(1)}
                    </div>
                    <div class="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#86868b] font-medium mt-1">
                        Est. Points
                    </div>
                </div>
            </div>

            <!-- Middle: Responsive Layout (Centered on mobile, horizontal on sm+) -->
            <div class="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 text-center sm:text-left">
                <div class="relative flex-shrink-0">
                    <div class="absolute -inset-2 rounded-3xl opacity-30 group-hover:opacity-70 blur-xl transition-opacity duration-300"
                         style="background: ${theme.accent};"></div>
                    <img src="${player.headshot_url}"
                         alt="${name}"
                         loading="lazy"
                         class="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-neutral-900 border border-white/10 shadow-lg group-hover:scale-105 transition-transform duration-300 mx-auto"
                         style="-webkit-backface-visibility: hidden; transform: translateZ(0); image-rendering: -webkit-optimize-contrast;"
                         onerror="this.replaceWith(makeAppleFallback('${initials}', '${theme.accent}'))">
                </div>

                <div class="flex-grow min-w-0 w-full sm:w-auto">
                    <h3 class="font-bold text-white text-lg sm:text-xl truncate tracking-tight mb-2 group-hover:text-green-400 transition-colors">
                        ${name}
                    </h3>
                    <div class="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                        <span class="text-[10px] uppercase tracking-wider text-[#86868b] font-medium">vs</span>
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
    div.className = 'relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center font-bold text-2xl text-neutral-300 shadow-lg mx-auto';
    div.style.color = color;
    div.textContent = initials;
    return div;
};

window.setActivePosition = setActivePosition;

// --- App Mode Switcher (Rankings vs Trade Calculator) -----------------------

let APP_MODE = 'rankings'; // 'rankings' or 'calculator'
let sideAPlayers = [];
let sideBPlayers = [];

let ACTIVE_GRAPH_POSITION = 'wr';

function setAppMode(mode) {
    if (mode === APP_MODE) return;
    APP_MODE = mode;
    const rankBtn = document.getElementById('mode-rankings-btn');
    const calcBtn = document.getElementById('mode-calculator-btn');
    const graphsBtn = document.getElementById('mode-graphs-btn');
    const rankView = document.getElementById('rankings-view');
    const calcView = document.getElementById('trade-calculator-view');
    const graphsView = document.getElementById('season-graphs-view');
    const posTabs = document.getElementById('position-tabs');

    // Reset buttons
    [rankBtn, calcBtn, graphsBtn].forEach(b => {
        if (b) {
            b.classList.remove('active');
            b.classList.add('text-[#86868b]');
        }
    });

    // Hide all views
    [rankView, calcView, graphsView].forEach(v => {
        if (v) v.classList.add('hidden');
    });

    if (posTabs) posTabs.style.display = 'none';

    if (mode === 'rankings') {
        if (rankBtn) {
            rankBtn.classList.add('active');
            rankBtn.classList.remove('text-[#86868b]');
        }
        if (rankView) rankView.classList.remove('hidden');
        if (posTabs) posTabs.style.display = 'flex';
    } else if (mode === 'calculator') {
        if (calcBtn) {
            calcBtn.classList.add('active');
            calcBtn.classList.remove('text-[#86868b]');
        }
        if (calcView) calcView.classList.remove('hidden');
        updateTradeEvaluation();
    } else if (mode === 'graphs') {
        if (graphsBtn) {
            graphsBtn.classList.add('active');
            graphsBtn.classList.remove('text-[#86868b]');
        }
        if (graphsView) graphsView.classList.remove('hidden');
        renderGraphTabs();
        renderActiveGraph();
    }
}

function renderGraphTabs() {
    const tabsEl = document.getElementById('graph-position-tabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = POSITION_ORDER.map(key => {
        const theme = POSITION_THEMES[key];
        const isActive = key === ACTIVE_GRAPH_POSITION;
        return `
            <button
                type="button"
                role="tab"
                aria-selected="${isActive}"
                class="apple-pill px-4 py-2 rounded-xl font-semibold text-xs tracking-wide inline-flex items-center gap-2 ${isActive ? 'active' : 'text-[#86868b]'}"
                onclick="setActiveGraphPosition('${key}')">
                <span class="w-2 h-2 rounded-full" style="background: ${theme.accent}; box-shadow: 0 0 8px ${theme.accent};"></span>
                ${theme.label}
            </button>
        `;
    }).join('');
}

function setActiveGraphPosition(key) {
    if (!POSITION_THEMES[key] || key === ACTIVE_GRAPH_POSITION) return;
    ACTIVE_GRAPH_POSITION = key;
    renderGraphTabs();
    renderActiveGraph();
}

function renderActiveGraph() {
    const imgEl = document.getElementById('graph-image');
    if (!imgEl || !DATA || !DATA.plots) return;
    const plotDataUrl = DATA.plots[ACTIVE_GRAPH_POSITION];
    if (plotDataUrl) {
        imgEl.src = plotDataUrl;
    }
}

// --- Trade Calculator Engine ----------------------------------------------

function getAllPlayers() {
    if (!DATA) return [];
    let all = [];
    ['wr', 'rb', 'qb', 'te'].forEach(pos => {
        if (Array.isArray(DATA[pos])) {
            DATA[pos].forEach(p => {
                all.push({
                    ...p,
                    position: pos.toUpperCase(),
                    id: `${pos}-${p.player_name}`
                });
            });
        }
    });
    return all;
}

function filterPlayers(side, query) {
    const dropdownId = `dropdown-side-${side}`;
    const dropdown = document.getElementById(dropdownId);
    if (!DATA) {
        dropdown.classList.add('hidden');
        return;
    }

    const q = (query || '').toLowerCase().trim();
    const all = getAllPlayers();
    const selectedIds = new Set([
        ...sideAPlayers.map(p => p.id),
        ...sideBPlayers.map(p => p.id)
    ]);

    const matches = all.filter(p => {
        if (selectedIds.has(p.id)) return false;
        if (!q) return true;
        return p.player_name.toLowerCase().includes(q) || p.position.toLowerCase().includes(q) || (p.next_opponent && p.next_opponent.toLowerCase().includes(q));
    }).slice(0, 15);

    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="p-4 text-xs text-[#86868b] text-center">No players found</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = matches.map(p => {
        const theme = POSITION_THEMES[p.position.toLowerCase()] || POSITION_THEMES.wr;
        const name = formatName(p.player_name);
        return `
            <div onclick="addPlayerToSide('${side}', '${p.id}')" class="p-3 hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors">
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-white/10" style="color: ${theme.accent};">
                        ${p.position}
                    </span>
                    <span class="text-sm font-semibold text-white">${name}</span>
                </div>
                <div class="text-right">
                    <span class="text-sm font-bold text-white tabular">${(p.projection || 0).toFixed(1)}</span>
                    <span class="text-[10px] text-[#86868b] block">pts</span>
                </div>
            </div>
        `;
    }).join('');

    dropdown.classList.remove('hidden');
}

function addPlayerToSide(side, playerId) {
    const all = getAllPlayers();
    const player = all.find(p => p.id === playerId);
    if (!player) return;

    if (side === 'a') {
        sideAPlayers.push(player);
        document.getElementById('search-side-a').value = '';
        document.getElementById('dropdown-side-a').classList.add('hidden');
    } else {
        sideBPlayers.push(player);
        document.getElementById('search-side-b').value = '';
        document.getElementById('dropdown-side-b').classList.add('hidden');
    }

    updateTradeEvaluation();
}

function removePlayerFromSide(side, index) {
    if (side === 'a') {
        sideAPlayers.splice(index, 1);
    } else {
        sideBPlayers.splice(index, 1);
    }
    updateTradeEvaluation();
}

function getPlayerRealValue(p) {
    const proj = p.projection || 0;
    const baseline = p.prior_season_ppg || proj;
    
    // 1. Volume & Opportunity score (targets, touches, WOPR, target share)
    const volumeScore = (p.targets_ewma3 || 0) * 0.8 + 
                        (p.touches_ewma3 || 0) * 0.8 + 
                        (p.wopr_ewma3 || 0) * 5.0 + 
                        (p.target_share_ewma3 || 0) * 10.0;

    // 2. Yardage & Efficiency score
    const yardageScore = ((p.receiving_yards_ewma3 || 0) + (p.rushing_yards_ewma3 || 0) + (p.passing_yards_ewma3 || 0) / 10.0) * 0.15;

    // 3. Historical Pedigree & Baseline (Season-long form as a whole)
    const baselineScore = baseline * 0.45;

    // 4. Weekly Matchup & Consistency (Volatility std dev)
    const projScore = proj * 0.25;
    const std = p.fantasy_points_ppr_std5 || 4.0;
    const consistencyBonus = Math.max(0, (6.0 - std) * 0.1);

    // Composite True Trade Value blending volume, yardage, pedigree, projections, and consistency
    const composite = baselineScore + projScore + yardageScore + Math.min(5.0, volumeScore * 0.1) + consistencyBonus;
    return Math.max(1.0, composite);
}

function calculateSideTradeValue(players) {
    if (!players || players.length === 0) return 0;
    
    // Sort players by individual value descending (1st, 2nd, 3rd, 4th...)
    const sorted = [...players].map(p => getPlayerRealValue(p)).sort((a, b) => b - a);
    
    let totalVal = 0;
    
    if (sorted.length === 1) {
        totalVal = sorted[0];
    } else if (sorted.length === 2) {
        // 2v2 or 2v1: 1st player + slight diminishing returns for 2nd
        totalVal = sorted[0] + (sorted[1] * 0.85);
    } else {
        // Multi-player packages (e.g. 1st & 4th vs 2nd & 3rd principle)
        // Diminishing returns for deeper bench pieces (3rd, 4th players)
        totalVal = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
            const weight = Math.max(0.4, 0.85 - (i - 1) * 0.15);
            totalVal += sorted[i] * weight;
        }
    }
    
    return totalVal;
}

function updateTradeEvaluation() {
    // Render Side A list
    const listA = document.getElementById('list-side-a');
    const countA = document.getElementById('side-a-count');
    countA.textContent = `${sideAPlayers.length} player${sideAPlayers.length === 1 ? '' : 's'}`;

    if (sideAPlayers.length === 0) {
        listA.innerHTML = '<p class="text-xs text-[#86868b] text-center py-8">No players added to Side A yet.</p>';
    } else {
        listA.innerHTML = sideAPlayers.map((p, idx) => renderTradePlayerCard(p, 'a', idx)).join('');
    }

    // Render Side B list
    const listB = document.getElementById('list-side-b');
    const countB = document.getElementById('side-b-count');
    countB.textContent = `${sideBPlayers.length} player${sideBPlayers.length === 1 ? '' : 's'}`;

    if (sideBPlayers.length === 0) {
        listB.innerHTML = '<p class="text-xs text-[#86868b] text-center py-8">No players added to Side B yet.</p>';
    } else {
        listB.innerHTML = sideBPlayers.map((p, idx) => renderTradePlayerCard(p, 'b', idx)).join('');
    }

    // Calculate Package Values with Tier & Multi-player adjustments
    let valA = calculateSideTradeValue(sideAPlayers);
    let valB = calculateSideTradeValue(sideBPlayers);

    // Guardrail 1: 3-for-1 Roster Clutter Penalty (Uneven trade size penalty)
    if (sideAPlayers.length >= 3 && sideBPlayers.length === 1) {
        valA *= 0.88;
    } else if (sideBPlayers.length >= 3 && sideAPlayers.length === 1) {
        valB *= 0.88;
    } else if (sideAPlayers.length >= 4 && sideBPlayers.length <= 2) {
        valA *= 0.82;
    } else if (sideBPlayers.length >= 4 && sideAPlayers.length <= 2) {
        valB *= 0.82;
    }

    // Guardrail 2: Elite Protection Safeguard (Stud Shield against flash-in-the-pan sell-low traps)
    const eliteThreshold = 18.0;
    const sideAElite = sideAPlayers.find(p => getPlayerRealValue(p) >= eliteThreshold && (p.prior_season_ppg || 0) >= 15.0);
    const sideBElite = sideBPlayers.find(p => getPlayerRealValue(p) >= eliteThreshold && (p.prior_season_ppg || 0) >= 15.0);

    if (sideAElite && sideBPlayers.length > 1) {
        const hasVolatileFluke = sideBPlayers.some(p => (p.projection || 0) > 16.0 && (p.prior_season_ppg || 0) < 11.0);
        if (hasVolatileFluke) {
            valA *= 1.15;
        }
    }
    if (sideBElite && sideAPlayers.length > 1) {
        const hasVolatileFluke = sideAPlayers.some(p => (p.projection || 0) > 16.0 && (p.prior_season_ppg || 0) < 11.0);
        if (hasVolatileFluke) {
            valB *= 1.15;
        }
    }

    const baselineA = sideAPlayers.reduce((sum, p) => sum + (p.prior_season_ppg || 0), 0);
    const baselineB = sideBPlayers.reduce((sum, p) => sum + (p.prior_season_ppg || 0), 0);

    const volA = sideAPlayers.length > 0 ? (sideAPlayers.reduce((sum, p) => sum + (p.fantasy_points_ppr_std5 || 0), 0) / sideAPlayers.length) : 0;
    const volB = sideBPlayers.length > 0 ? (sideBPlayers.reduce((sum, p) => sum + (p.fantasy_points_ppr_std5 || 0), 0) / sideBPlayers.length) : 0;

    document.getElementById('side-a-total-pts').textContent = valA.toFixed(1);
    document.getElementById('side-b-total-pts').textContent = valB.toFixed(1);

    document.getElementById('side-a-baseline').textContent = baselineA.toFixed(1) + ' ppg';
    document.getElementById('side-b-baseline').textContent = baselineB.toFixed(1) + ' ppg';

    document.getElementById('side-a-vol').textContent = volA.toFixed(1) + ' std';
    document.getElementById('side-b-vol').textContent = volB.toFixed(1) + ' std';

    // Verdict based on Advanced True Trade Value (You Receive vs You Give)
    const diff = valB - valA; // Net gain for you (Receive minus Give)
    const verdictTitle = document.getElementById('trade-verdict-title');
    const verdictSub = document.getElementById('trade-verdict-sub');

    if (sideAPlayers.length === 0 && sideBPlayers.length === 0) {
        verdictTitle.textContent = 'Select players to evaluate trade';
        verdictSub.textContent = 'Compare volume, yardage, career pedigree, and package tier value.';
    } else if (Math.abs(diff) <= 1.2) {
        verdictTitle.textContent = '🤝 Fair & Balanced Trade';
        verdictSub.textContent = `True trade value is even (±${Math.abs(diff).toFixed(1)} pts).`;
    } else if (diff > 0) {
        verdictTitle.textContent = `📈 Accept Trade — You Win (+${diff.toFixed(1)} Value)`;
        verdictSub.textContent = 'You are receiving superior overall player value, volume, and pedigree in return.';
    } else {
        verdictTitle.textContent = `📉 Decline Trade — You Lose (-${Math.abs(diff).toFixed(1)} Value)`;
        verdictSub.textContent = 'You are giving up more value than you receive in return.';
    }
}

function renderTradePlayerCard(player, side, index) {
    const theme = POSITION_THEMES[player.position.toLowerCase()] || POSITION_THEMES.wr;
    const name = formatName(player.player_name);
    return `
        <div class="apple-glass rounded-2xl p-3.5 flex items-center justify-between gap-3 group">
            <div class="flex items-center gap-3 min-w-0">
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-xl border border-white/10 flex-shrink-0" style="color: ${theme.accent};">
                    ${player.position}
                </span>
                <div class="min-w-0">
                    <h5 class="font-bold text-white text-sm truncate">${name}</h5>
                    <p class="text-[10px] text-[#86868b]">vs ${player.next_opponent || 'BYE'}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                <div class="text-right">
                    <span class="font-bold text-white text-base tabular">${(player.projection || 0).toFixed(1)}</span>
                    <span class="text-[9px] text-[#86868b] block">proj</span>
                </div>
                <button type="button" onclick="removePlayerFromSide('${side}', ${index})" class="w-7 h-7 rounded-xl bg-white/5 hover:bg-red-500/20 text-[#86868b] hover:text-red-400 border border-white/10 flex items-center justify-center transition-colors">
                    &times;
                </button>
            </div>
        </div>
    `;
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-side-a') && !e.target.closest('#dropdown-side-a')) {
        const d = document.getElementById('dropdown-side-a');
        if (d) d.classList.add('hidden');
    }
    if (!e.target.closest('#search-side-b') && !e.target.closest('#dropdown-side-b')) {
        const d = document.getElementById('dropdown-side-b');
        if (d) d.classList.add('hidden');
    }
});

window.setAppMode = setAppMode;
window.filterPlayers = filterPlayers;
window.addPlayerToSide = addPlayerToSide;
window.removePlayerFromSide = removePlayerFromSide;
window.setActiveGraphPosition = setActiveGraphPosition;

fetchAndRender();
