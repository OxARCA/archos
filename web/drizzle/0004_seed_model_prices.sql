-- Starting prices: Anthropic first-party rates in US$ per million tokens, checked 2026-09-13.
-- After this, prices are edited on /admin/prices. This runs once.
INSERT INTO "model_prices" ("provider", "model", "input", "output", "cache_read", "cache_write_5m", "cache_write_1h", "batch_discount_percent") VALUES
  ('anthropic', 'claude-opus-5', 5, 25, 0.5, 6.25, 10, 50),
  ('anthropic', 'claude-sonnet-5', 2, 10, 0.2, 2.5, 4, 50),
  ('anthropic', 'claude-haiku-4-5', 1, 5, 0.1, 1.25, 2, 50)
ON CONFLICT DO NOTHING;
