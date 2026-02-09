-- Database initialization script
-- This sets up the optimized schema for high-scale ingestion

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- OPERATIONAL STORE (HOT DATA)
-- =====================================================

-- Current meter status (UPSERT strategy)
CREATE TABLE IF NOT EXISTS meter_current_status (
    meter_id VARCHAR(50) PRIMARY KEY,
    kwh_consumed_ac DECIMAL(10, 4) NOT NULL,
    voltage DECIMAL(8, 2) NOT NULL,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Current vehicle status (UPSERT strategy)
CREATE TABLE IF NOT EXISTS vehicle_current_status (
    vehicle_id VARCHAR(50) PRIMARY KEY,
    soc DECIMAL(5, 2) NOT NULL CHECK (soc >= 0 AND soc <= 100),
    kwh_delivered_dc DECIMAL(10, 4) NOT NULL,
    battery_temp DECIMAL(5, 2) NOT NULL,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for operational queries
CREATE INDEX IF NOT EXISTS idx_meter_status_last_updated ON meter_current_status(last_updated);
CREATE INDEX IF NOT EXISTS idx_vehicle_status_last_updated ON vehicle_current_status(last_updated);

-- =====================================================
-- HISTORICAL STORE (COLD DATA)
-- =====================================================

-- Meter telemetry history (INSERT-only, append)
CREATE TABLE IF NOT EXISTS meter_telemetry_history (
    id BIGSERIAL PRIMARY KEY,
    meter_id VARCHAR(50) NOT NULL,
    kwh_consumed_ac DECIMAL(10, 4) NOT NULL,
    voltage DECIMAL(8, 2) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle telemetry history (INSERT-only, append)
CREATE TABLE IF NOT EXISTS vehicle_telemetry_history (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    soc DECIMAL(5, 2) NOT NULL CHECK (soc >= 0 AND soc <= 100),
    kwh_delivered_dc DECIMAL(10, 4) NOT NULL,
    battery_temp DECIMAL(5, 2) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes optimized for analytical queries
-- Composite indexes for time-range + vehicle_id queries
CREATE INDEX IF NOT EXISTS idx_meter_history_meter_timestamp 
    ON meter_telemetry_history(meter_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_history_vehicle_timestamp 
    ON vehicle_telemetry_history(vehicle_id, timestamp DESC);

-- Indexes for time-based partitioning queries
CREATE INDEX IF NOT EXISTS idx_meter_history_timestamp 
    ON meter_telemetry_history(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_history_timestamp 
    ON vehicle_telemetry_history(timestamp DESC);

-- =====================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- =====================================================

-- Pre-computed hourly aggregates for faster analytics
-- This reduces full table scans for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS vehicle_hourly_analytics AS
SELECT 
    vehicle_id,
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(soc) as avg_soc,
    MAX(soc) as max_soc,
    MIN(soc) as min_soc,
    AVG(battery_temp) as avg_battery_temp,
    SUM(kwh_delivered_dc) as total_kwh_delivered_dc,
    COUNT(*) as reading_count
FROM vehicle_telemetry_history
GROUP BY vehicle_id, DATE_TRUNC('hour', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_hourly_analytics_vehicle_hour 
    ON vehicle_hourly_analytics(vehicle_id, hour DESC);

-- Meter hourly aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS meter_hourly_analytics AS
SELECT 
    meter_id,
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(voltage) as avg_voltage,
    SUM(kwh_consumed_ac) as total_kwh_consumed_ac,
    COUNT(*) as reading_count
FROM meter_telemetry_history
GROUP BY meter_id, DATE_TRUNC('hour', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meter_hourly_analytics_meter_hour 
    ON meter_hourly_analytics(meter_id, hour DESC);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to refresh materialized views (should be called periodically)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY vehicle_hourly_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY meter_hourly_analytics;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTITIONING STRATEGY (Optional for future scaling)
-- =====================================================

-- Note: For production at scale (billions of rows), consider partitioning by timestamp
-- Example: Partition meter_telemetry_history by month
-- This is commented out but shows the strategy:

/*
CREATE TABLE meter_telemetry_history_2024_01 PARTITION OF meter_telemetry_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE meter_telemetry_history_2024_02 PARTITION OF meter_telemetry_history
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
*/

-- =====================================================
-- INITIAL DATA & COMMENTS
-- =====================================================

COMMENT ON TABLE meter_current_status IS 'Hot operational store - current meter readings (UPSERT)';
COMMENT ON TABLE vehicle_current_status IS 'Hot operational store - current vehicle status (UPSERT)';
COMMENT ON TABLE meter_telemetry_history IS 'Cold analytical store - all meter readings over time (INSERT-only)';
COMMENT ON TABLE vehicle_telemetry_history IS 'Cold analytical store - all vehicle readings over time (INSERT-only)';
