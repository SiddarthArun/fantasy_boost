import nflreadpy as nfl  # or nflreadpy, whatever you're using
import pandas as pd
import json
from xgboost import XGBRegressor
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

try:
    df = nfl.load_player_stats(seasons=[2023,2024,2025,2026], summary_level='week').to_pandas()
except:
    try:
        df = nfl.load_player_stats(seasons=[2023,2024,2025], summary_level='week').to_pandas()
    except:
        df = nfl.load_player_stats(seasons=[2023,2024], summary_level='week').to_pandas()
    
df = df.sort_values(['player_id', 'season', 'week']).reset_index(drop=True)
df = df[df['season_type'] == 'REG']

# Get current week and set schedules
df['time_idx'] = df['season'] * 100 + df['week']
latest_season = df['season'].max()
latest_week = df[df['season'] == latest_season]['week'].max()

target_week = latest_week + 1
target_season = latest_season
if target_week > 18:
    target_week = 1
    target_season += 1

schedules = nfl.load_schedules(seasons=[target_season]).to_pandas()
target_week_games = schedules[(schedules.season == target_season) & (schedules.week == target_week)]

if target_week_games.empty:
    raise ValueError(f"No schedule found for {target_season} week {target_week} — check if season has been published yet")

team_next_opp = {}
for _, row in target_week_games.iterrows():
    team_next_opp[row['home_team']] = row['away_team']
    team_next_opp[row['away_team']] = row['home_team']

print(f"Most recent completed: {latest_season} wk{latest_week} -> projecting {target_season} wk{target_week}")

# FUNCTIONS
def get_top_n(df, feature_cols, model, team_next_opp, n=10, min_games=3, max_weeks_stale=3):
    latest = df.sort_values(['player_id', 'season', 'week']).groupby('player_id').tail(1).copy()
    latest = latest[latest['games_played_so_far'] >= min_games]

    # Filter out the injured
    latest['time_idx'] = latest['season'] * 100 + latest['week']
    most_recent_time = latest['time_idx'].max()
    latest = latest[latest['time_idx'] >= most_recent_time - max_weeks_stale]

    # Use the correct defense
    latest['next_opponent'] = latest['team'].map(team_next_opp)

    def_current = (
        df.sort_values(['opponent_team', 'position', 'season', 'week'])
        .groupby(['opponent_team', 'position'])
        .tail(1)[['opponent_team', 'position', 'def_allowed_l4w']]
        .rename(columns={'opponent_team': 'next_opponent', 'def_allowed_l4w': 'def_allowed_l4w_upcoming'})
    )
    latest = latest.merge(def_current, on=['next_opponent', 'position'], how='left')
    latest['def_allowed_l4w'] = latest['def_allowed_l4w_upcoming'].fillna(latest['def_allowed_l4w'])

    latest['projection'] = model.predict(latest[feature_cols])
    trade_cols = ['player_name', 'projection', 'headshot_url', 'next_opponent', 'prior_season_ppg', 'fantasy_points_ppr_std5', 'position', 'targets_ewma3', 'touches_ewma3', 'wopr_ewma3', 'receiving_yards_ewma3', 'rushing_yards_ewma3', 'passing_yards_ewma3', 'target_share_ewma3']
    for col in trade_cols:
        if col not in latest.columns:
            latest[col] = 0
        else:
            latest[col] = latest[col].fillna(0)
    return latest[trade_cols].sort_values('projection', ascending=False).head(n)

# FEATURE ENGINEERING ------------------------------------------------------------------
# Weighted Opportunities
df['wopr'] = (1.5*df['target_share']) + (0.7*df['air_yards_share'])

# RB Touches
df['touches'] = df['carries'] + df['targets']

# EWMA Scaled stats
ewma_metrics = ['fantasy_points_ppr', 'wopr', 'targets', 'receptions', 'receiving_yards', 'receiving_air_yards', 'receiving_yards_after_catch', 'receiving_first_downs', 'receiving_10', 'rushing_10','touches','receiving_20', 'target_share', 'air_yards_share', 'carries', 'rushing_yards', 'rushing_tds', 'rushing_first_downs', 'rushing_epa', 'completions', 'passing_yards', 'passing_tds', 'passing_interceptions', 'sacks_suffered', 'pacr', 'passing_epa', 'passing_cpoe', 'attempts']
for col in ewma_metrics:
    df[f'{col}_ewma3'] = df.groupby('player_id')[col].transform(lambda x: x.shift(1).ewm(span=4, min_periods=1).mean())

# Prior season performance
prior_season_avg = df.groupby(['player_id', 'season'])['fantasy_points_ppr'].mean().reset_index()
prior_season_avg['season'] += 1
prior_season_avg = prior_season_avg.rename(columns={'fantasy_points_ppr': 'prior_season_ppg'})
df = df.drop(columns=['prior_season_ppg'], errors='ignore')
df = df.merge(prior_season_avg, on=['player_id', 'season'], how='left')
df['prior_season_ppg'] = df['prior_season_ppg'].fillna(0)  # or fillna with league-average rookie WR output

# Boom/Bust likelihood
df['fantasy_points_ppr_std5'] = df.groupby('player_id')['fantasy_points_ppr'].transform(
    lambda x: x.shift(1).rolling(5, min_periods=2).std()
)

# Games Played
df['games_played_so_far'] = df.groupby('player_id').cumcount()

# Defense Stats
def_allowed = df.groupby(['opponent_team', 'season', 'week', 'position'])['fantasy_points_ppr'].sum().reset_index().sort_values(['opponent_team', 'position', 'season', 'week'])
def_allowed['def_allowed_l4w'] = def_allowed.groupby(['opponent_team', 'position'])['fantasy_points_ppr'].transform(lambda x: x.shift(1).rolling(4,1).mean())

df = df.drop(columns=['def_allowed_l4w'], errors='ignore')  # NEW — clears any stale version first
df = df.merge(def_allowed[['opponent_team', 'season', 'week', 'position', 'def_allowed_l4w']], on=['opponent_team', 'season', 'week', 'position'], how='left')

# Split + Clean
wr_features = ['wopr_ewma3', 'fantasy_points_ppr_ewma3', 'receiving_yards_after_catch_ewma3', 'def_allowed_l4w', 'fantasy_points_ppr_std5', 'prior_season_ppg', 'games_played_so_far']
wrs = df[df['position'] == 'WR']
wr_clean_df = wrs.dropna(subset=wr_features + ['fantasy_points_ppr'])

rb_features = ['touches_ewma3','target_share_ewma3','fantasy_points_ppr_ewma3','rushing_epa_ewma3','rushing_10_ewma3','def_allowed_l4w','fantasy_points_ppr_std5','prior_season_ppg', 'games_played_so_far']
rbs = df[df['position'] == 'RB']
rb_clean_df = rbs.dropna(subset=rb_features + ['fantasy_points_ppr'])

qb_features = ['fantasy_points_ppr_ewma3','attempts_ewma3','carries_ewma3','passing_epa_ewma3','passing_cpoe_ewma3','rushing_epa_ewma3','sacks_suffered_ewma3','def_allowed_l4w','fantasy_points_ppr_std5','prior_season_ppg']
qbs = df[df['position'] == 'QB']
qb_clean_df = qbs.dropna(subset=qb_features + ['fantasy_points_ppr'])

te_features = ['wopr_ewma3', 'fantasy_points_ppr_ewma3', 'receiving_yards_after_catch_ewma3', 'def_allowed_l4w', 'fantasy_points_ppr_std5', 'prior_season_ppg']
tes = df[df['position'] == 'TE']
te_clean_df = tes.dropna(subset=te_features + ['fantasy_points_ppr'])


# MODEL TRAINING ----------------------------------------------
wr_model = XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05)
wr_model.fit(wr_clean_df[wr_features], wr_clean_df['fantasy_points_ppr'])

rb_model = XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05)
rb_model.fit(rb_clean_df[rb_features], rb_clean_df['fantasy_points_ppr'])

qb_model = XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05)
qb_model.fit(qb_clean_df[qb_features], qb_clean_df['fantasy_points_ppr'])

te_model = XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05)
te_model.fit(te_clean_df[te_features], te_clean_df['fantasy_points_ppr'])



def generate_trajectory_plot(df, position, metrics_dict, n_players=40):
    plot_season = 2026
    pos_df = df[(df['position'] == position) & (df['season'] == plot_season)].copy()
    if pos_df.empty:
        plot_season = df['season'].max()
        pos_df = df[(df['position'] == position) & (df['season'] == plot_season)].copy()
    if pos_df.empty:
        return ""
    
    top_players = pos_df.groupby('player_name')['fantasy_points_ppr'].sum().nlargest(n_players).index.tolist()
    
    distinct_colors = [
        '#30d158', '#0a84ff', '#ffd60a', '#bf5af2', '#ff9f0a', '#32ade6', '#ff375f', '#64d2ff', '#acce22', '#ff453a',
        '#5ac8fa', '#5856d6', '#ff2d55', '#4cd964', '#5fc9f8', '#ffcc00', '#af52de', '#ff9500', '#34c759', '#007aff',
        '#e066ff', '#00ced1', '#ff1493', '#7cfc00', '#ff6347', '#4682b4', '#da70d6', '#32cd32', '#ba55d3', '#00fa9a',
        '#ffa500', '#1e90ff', '#ff69b4', '#adff2f', '#db7093', '#00bfff', '#ffb6c1', '#98fb98', '#dda0dd', '#f0e68c'
    ]
    
    fig, axes = plt.subplots(len(metrics_dict), 1, figsize=(12, 6 * len(metrics_dict)), facecolor='#121214')
    if len(metrics_dict) == 1:
        axes = [axes]
    
    for idx, (metric_col, metric_title) in enumerate(metrics_dict.items()):
        ax = axes[idx]
        ax.set_facecolor('#161618')
        
        for i, player in enumerate(top_players):
            player_data = pos_df[pos_df['player_name'] == player].sort_values('week')
            if not player_data.empty and metric_col in player_data.columns:
                color = distinct_colors[i % len(distinct_colors)]
                alpha = 0.9 if i < 15 else 0.5
                linewidth = 1.8 if i < 15 else 1.0
                
                ax.plot(player_data['week'], player_data[metric_col], 
                        marker='o', markersize=4, linewidth=linewidth, 
                        color=color, alpha=alpha)
                
                # Direct labeling on the last week data point for ALL subplots
                last_row = player_data.iloc[-1]
                ax.text(last_row['week'] + 0.3, last_row[metric_col], player, 
                        color=color, fontsize=7.5, fontweight='bold', va='center', alpha=0.95)
                
        ax.set_title(metric_title, fontsize=13, fontweight='bold', color='#f5f5f7', pad=12)
        ax.set_xlabel('NFL Week', fontsize=10, color='#86868b', labelpad=6)
        ax.set_ylabel(metric_title, fontsize=10, color='#86868b', labelpad=6)
        
        max_wk = pos_df['week'].max()
        ax.set_xlim(left=0.5, right=max(max_wk + 4.5, 5.5))
        
        ax.tick_params(colors='#86868b', labelsize=9)
        for spine in ax.spines.values():
            spine.set_color('#2c2c2e')
            
        ax.grid(True, linestyle='--', alpha=0.15, color='#ffffff')
        
    fig.suptitle(f'Top {n_players} {position}s — Season Trajectories ({plot_season})', fontsize=18, fontweight='bold', color='#f5f5f7', y=1.01)
    plt.tight_layout()
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=200, bbox_inches='tight', facecolor=fig.get_facecolor())
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    
    return f"data:image/png;base64,{img_base64}"

# OUTPUTS -----------------------------------------------------
top_wr = get_top_n(wr_clean_df, wr_features, wr_model, team_next_opp, n=42)
top_rb = get_top_n(rb_clean_df, rb_features, rb_model, team_next_opp, n=42)
top_qb = get_top_n(qb_clean_df, qb_features, qb_model, team_next_opp, n=21)
top_te = get_top_n(te_clean_df, te_features, te_model, team_next_opp, n=21)

plots = {
    "wr": generate_trajectory_plot(df, 'WR', {
        'fantasy_points_ppr': 'Weekly PPR Fantasy Points',
        'targets': 'Targets',
        'receiving_yards': 'Receiving Yards',
        'target_share': 'Target Share'
    }, n_players=42),
    "rb": generate_trajectory_plot(df, 'RB', {
        'fantasy_points_ppr': 'Weekly PPR Fantasy Points',
        'touches': 'Touches (Carries + Targets)',
        'rushing_yards': 'Rushing Yards',
        'targets': 'Targets'
    }, n_players=42),
    "qb": generate_trajectory_plot(df, 'QB', {
        'fantasy_points_ppr': 'Weekly PPR Fantasy Points',
        'passing_yards': 'Passing Yards',
        'attempts': 'Passing Attempts',
        'rushing_yards': 'Rushing Yards'
    }, n_players=21),
    "te": generate_trajectory_plot(df, 'TE', {
        'fantasy_points_ppr': 'Weekly PPR Fantasy Points',
        'targets': 'Targets',
        'receiving_yards': 'Receiving Yards',
        'target_share': 'Target Share'
    }, n_players=21),
}

output = {
    "generated_at": pd.Timestamp.utcnow().isoformat(),
    "wr": top_wr.to_dict(orient='records'),
    "rb": top_rb.to_dict(orient='records'),
    "qb": top_qb.to_dict(orient='records'),
    "te": top_te.to_dict(orient='records'),
    "plots": plots,
}

with open('frontend/projections.json', 'w') as f:
    json.dump(output, f, indent=2)
