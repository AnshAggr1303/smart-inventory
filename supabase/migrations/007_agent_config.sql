-- Add agent_config JSONB column to organisations.
-- Stores per-org agent enable/disable flags and threshold settings.
-- Defaults all agents to enabled with standard thresholds.

alter table organisations
add column if not exists agent_config jsonb default '{
  "reorder_enabled": true,
  "shrinkage_enabled": true,
  "forecast_enabled": true,
  "shrinkage_threshold_pct": 5,
  "forecast_horizon_days": 7,
  "reorder_lead_time_days": 3
}'::jsonb;
