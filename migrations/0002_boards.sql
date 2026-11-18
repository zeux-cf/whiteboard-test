CREATE TABLE boards (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX boards_owner_updated ON boards(owner_id, updated_at DESC);

CREATE TABLE board_members (
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (board_id, user_id)
);
CREATE INDEX board_members_by_user ON board_members(user_id, board_id);

CREATE TABLE board_invites (
  id TEXT PRIMARY KEY NOT NULL,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at TEXT NOT NULL
);
CREATE INDEX board_invites_by_board ON board_invites(board_id, created_at DESC);
