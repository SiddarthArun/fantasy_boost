import nflreadpy as nfl  # or nflreadpy, whatever you're using
import pandas as pd
import json
from xgboost import XGBRegressor

df = nfl.load_player_stats(seasons=[2023,2024,2025], summary_level='week').to_pandas()
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

print(f"Most recent completed: {latest_season} wk{latest_week} → projecting {target_season} wk{target_week}")

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
    return latest[['player_name', 'projection', 'headshot_url', 'next_opponent']].sort_values('projection', ascending=False).head(n)

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

# OUTPUTS -----------------------------------------------------
top_wr = get_top_n(wr_clean_df, wr_features, wr_model, team_next_opp, n=20)
top_rb = get_top_n(rb_clean_df, rb_features, rb_model, team_next_opp, n=20)
top_qb = get_top_n(qb_clean_df, qb_features, qb_model, team_next_opp, n=12)
top_te = get_top_n(te_clean_df, te_features, te_model, team_next_opp, n=12)

output = {
    "generated_at": pd.Timestamp.utcnow().isoformat(),
    "wr": top_wr.to_dict(orient='records'),
    "rb": top_rb.to_dict(orient='records'),
    "qb": top_qb.to_dict(orient='records'),
    "te": top_te.to_dict(orient='records'),
}

with open('frontend/projections.json', 'w') as f:
    json.dump(output, f, indent=2)
