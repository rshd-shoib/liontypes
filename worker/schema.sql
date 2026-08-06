CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  wpm REAL NOT NULL,
  accuracy REAL NOT NULL,
  mode TEXT NOT NULL,
  amount INTEGER,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_wpm ON scores (wpm DESC);
CREATE INDEX IF NOT EXISTS idx_scores_ip_time ON scores (ip, created_at DESC);
