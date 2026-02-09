# Architecture Deep Dive

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Design](#database-design)
3. [Performance Optimizations](#performance-optimizations)
4. [Scalability Strategy](#scalability-strategy)
5. [Monitoring & Observability](#monitoring--observability)

## System Overview

### Technology Stack
- **Runtime**: Node.js 18 (LTS)
- **Framework**: NestJS 10.x (TypeScript)
- **ORM**: TypeORM 0.3.x
- **Database**: PostgreSQL 15
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI 3.0
- **Containerization**: Docker & Docker Compose

### Design Principles
1. **Separation of Concerns**: Controllers → Services → Repositories
2. **Type Safety**: Full TypeScript coverage, strict mode
3. **Testability**: Dependency injection, mockable services
4. **Performance**: Indexed queries, connection pooling, batch operations
5. **Maintainability**: Clear naming, comprehensive documentation

## Database Design

### Entity Relationship Diagram

```
┌─────────────────────────┐         ┌─────────────────────────┐
│ meter_current_status    │         │ vehicle_current_status  │
├─────────────────────────┤         ├─────────────────────────┤
│ PK meter_id             │         │ PK vehicle_id           │
│    kwh_consumed_ac      │         │    soc                  │
│    voltage              │         │    kwh_delivered_dc     │
│    last_updated         │         │    battery_temp         │
│    created_at           │         │    last_updated         │
└─────────────────────────┘         │    created_at           │
                                    └─────────────────────────┘
           │                                    │
           │ 1:N                            1:N │
           ▼                                    ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│meter_telemetry_history  │         │vehicle_telemetry_history│
├─────────────────────────┤         ├─────────────────────────┤
│ PK id (bigint)          │         │ PK id (bigint)          │
│    meter_id             │         │    vehicle_id           │
│    kwh_consumed_ac      │         │    soc                  │
│    voltage              │         │    kwh_delivered_dc     │
│    timestamp            │         │    battery_temp         │
│    ingested_at          │         │    timestamp            │
└─────────────────────────┘         │    ingested_at          │
                                    └─────────────────────────┘
```

### Index Strategy

#### Current Status Tables (Hot)
```sql
-- Primary key provides O(1) lookup
CREATE UNIQUE INDEX ON meter_current_status(meter_id);
CREATE UNIQUE INDEX ON vehicle_current_status(vehicle_id);

-- Secondary index for time-based queries
CREATE INDEX ON meter_current_status(last_updated);
CREATE INDEX ON vehicle_current_status(last_updated);
```

#### Historical Tables (Cold)
```sql
-- Composite index for range queries
-- Order matters: device_id (high selectivity) before timestamp
CREATE INDEX idx_meter_history_meter_timestamp 
    ON meter_telemetry_history(meter_id, timestamp DESC);

CREATE INDEX idx_vehicle_history_vehicle_timestamp 
    ON vehicle_telemetry_history(vehicle_id, timestamp DESC);

-- Standalone timestamp index for global time-range queries
CREATE INDEX idx_meter_history_timestamp 
    ON meter_telemetry_history(timestamp DESC);

CREATE INDEX idx_vehicle_history_timestamp 
    ON vehicle_telemetry_history(timestamp DESC);
```

### Query Patterns & Index Usage

#### Pattern 1: Get Current Status
```sql
-- Uses: Primary key index
SELECT soc FROM vehicle_current_status WHERE vehicle_id = 'VEHICLE-001';
-- Cost: O(1) - Direct hash lookup
-- Execution time: ~1ms
```

#### Pattern 2: 24-Hour Analytics
```sql
-- Uses: idx_vehicle_history_vehicle_timestamp
SELECT SUM(kwh_delivered_dc), AVG(battery_temp)
FROM vehicle_telemetry_history
WHERE vehicle_id = 'VEHICLE-001'
  AND timestamp >= NOW() - INTERVAL '24 hours';
-- Cost: O(log n + k) where k = matching rows (~1,440)
-- Execution time: ~50-100ms
```

#### Pattern 3: Recent Global Activity
```sql
-- Uses: idx_vehicle_history_timestamp
SELECT vehicle_id, soc, timestamp
FROM vehicle_telemetry_history
WHERE timestamp >= NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 100;
-- Cost: O(log n + 100)
-- Execution time: ~20-50ms
```

## Performance Optimizations

### 1. Connection Pooling

```typescript
// database.config.ts
extra: {
  max: 20,              // Maximum connections
  min: 5,               // Minimum idle connections
  idleTimeoutMillis: 30000,  // Close idle after 30s
  connectionTimeoutMillis: 2000  // Fail fast if no connection
}
```

**Why 20 connections?**
- 10K devices × 60s interval = ~167 req/sec
- Each request takes ~50ms (UPSERT + INSERT)
- Concurrent load: 167 × 0.05 = ~8.4 connections
- 20 connections provides 2.4× buffer for spikes

### 2. Batch Ingestion

```typescript
// Single record: 2 queries per ingestion
await upsert(current_status);  // 1 query
await insert(history);         // 1 query

// Batch of 100: Still 2 queries total!
await upsert(current_status, 100 rows);  // 1 query
await insert(history, 100 rows);         // 1 query

// Network round-trips: 200 → 2 (100× improvement)
```

### 3. Transaction Management

```typescript
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.startTransaction();
try {
  await queryRunner.manager.upsert(...);  // Hot path
  await queryRunner.manager.insert(...);   // Cold path
  await queryRunner.commitTransaction();   // Atomic commit
} catch (error) {
  await queryRunner.rollbackTransaction(); // All or nothing
  throw error;
} finally {
  await queryRunner.release();             // Return to pool
}
```

**Benefits**:
- Atomicity: Both writes succeed or both fail
- Consistency: No partial state in database
- Isolation: Other queries see old or new state, never in-between
- Durability: WAL ensures crash recovery

### 4. Write-Ahead Logging (PostgreSQL)

PostgreSQL's WAL provides:
- **Durability**: Changes written to disk asynchronously
- **Crash Recovery**: Replay log to restore consistent state
- **Replication**: Stream WAL to replicas

Tuning for high write throughput:
```sql
-- postgresql.conf optimizations
wal_buffers = 16MB              -- Buffer WAL writes
checkpoint_timeout = 15min      -- Less frequent checkpoints
max_wal_size = 4GB              -- Larger WAL before checkpoint
synchronous_commit = off        -- Accept minor data loss for speed (optional)
```

## Scalability Strategy

### Current Capacity (Single Instance)

| Metric | Capacity | Calculation |
|--------|----------|-------------|
| Devices | 10,000 | Limited by ingestion rate |
| Writes/sec | ~330 | 20,000 devices ÷ 60s |
| Daily Records | 28.8M | 20,000 × 1,440 |
| Annual Records | 10.5B | 28.8M × 365 |
| DB Size (1 year) | ~500 GB | 10.5B × 50 bytes/row |

### Horizontal Scaling (10K → 100K Devices)

#### 1. Read Replicas
```
┌─────────┐
│ Primary │ ◄──── Writes (ingestion)
└────┬────┘
     │ WAL Streaming
     ├───────┬───────┬────────┐
     ▼       ▼       ▼        ▼
  ┌────┐  ┌────┐  ┌────┐  ┌────┐
  │Rep1│  │Rep2│  │Rep3│  │Rep4│ ◄──── Reads (analytics)
  └────┘  └────┘  └────┘  └────┘
```

**Benefits**:
- Analytics queries don't impact ingestion
- Linear read scaling (4 replicas = 4× read capacity)
- Geographic distribution (low-latency global access)

#### 2. Sharding by Device ID

```typescript
// Hash-based sharding
function getShardId(vehicleId: string): number {
  const hash = murmurhash(vehicleId);
  return hash % SHARD_COUNT;
}

// Shard 0: VEHICLE-0001, VEHICLE-0004, VEHICLE-0007, ...
// Shard 1: VEHICLE-0002, VEHICLE-0005, VEHICLE-0008, ...
// Shard 2: VEHICLE-0003, VEHICLE-0006, VEHICLE-0009, ...
```

**Trade-offs**:
- ✅ Linear write scaling (4 shards = 4× write capacity)
- ✅ Smaller indexes per shard (faster queries)
- ❌ Cross-shard analytics require fan-out
- ❌ Rebalancing on shard addition is complex

#### 3. Time-Based Partitioning

```sql
-- Partition by month
CREATE TABLE vehicle_telemetry_history_2024_01 PARTITION OF vehicle_telemetry_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE vehicle_telemetry_history_2024_02 PARTITION OF vehicle_telemetry_history
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Old partitions can be:
-- - Archived to S3
-- - Compressed
-- - Moved to slower storage
-- - Dropped if beyond retention
```

**Benefits**:
- Fast pruning (query only relevant partitions)
- Easy archival (detach old partitions)
- Smaller indexes (per-partition indexes)

### Vertical Scaling (More Power)

| Component | Current | Scaled | Impact |
|-----------|---------|--------|--------|
| CPU | 4 cores | 16 cores | 4× concurrent writes |
| RAM | 8 GB | 32 GB | Larger cache, more connections |
| Disk | HDD | NVMe SSD | 10× faster writes |
| Network | 1 Gbps | 10 Gbps | 10× throughput |

**Cost-Benefit**: Vertical scaling easier to implement but hits physical limits.

### Caching Layer (Redis)

```typescript
// Cache current status for ultra-fast dashboard queries
async getCurrentSoC(vehicleId: string): Promise<number> {
  // Try cache first (1ms)
  const cached = await redis.get(`soc:${vehicleId}`);
  if (cached) return parseFloat(cached);

  // Fallback to database (10ms)
  const result = await this.vehicleStatusRepo.findOne({ 
    where: { vehicleId } 
  });
  
  // Cache for 1 minute (aligned with ingestion frequency)
  await redis.setex(`soc:${vehicleId}`, 60, result.soc);
  
  return result.soc;
}
```

**When to cache**:
- ✅ Current status (reads >>> writes)
- ❌ Historical data (large dataset, low cache hit rate)

## Monitoring & Observability

### Application Metrics (Prometheus)

```typescript
// Custom metrics
const ingestCounter = new promClient.Counter({
  name: 'telemetry_ingested_total',
  help: 'Total telemetry records ingested',
  labelNames: ['type', 'status']
});

const ingestDuration = new promClient.Histogram({
  name: 'telemetry_ingest_duration_seconds',
  help: 'Ingestion latency',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Usage
const start = Date.now();
try {
  await this.ingestVehicleTelemetry(data);
  ingestCounter.inc({ type: 'vehicle', status: 'success' });
} catch (error) {
  ingestCounter.inc({ type: 'vehicle', status: 'error' });
  throw error;
} finally {
  ingestDuration.observe((Date.now() - start) / 1000);
}
```

### Database Metrics

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Cache hit ratio (target: >99%)
SELECT 
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio
FROM pg_statio_user_tables;

-- Index usage
SELECT 
  schemaname, tablename, indexname, 
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- >100ms
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Alerting Rules

```yaml
# Prometheus alerts
groups:
  - name: energy_ingestion
    rules:
      - alert: HighIngestionLatency
        expr: histogram_quantile(0.95, telemetry_ingest_duration_seconds) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Ingestion p95 latency > 1s"

      - alert: LowEfficiency
        expr: avg(vehicle_efficiency_ratio) < 0.75
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "Fleet efficiency below 75% - potential hardware fault"

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.9
        for: 5m
        labels:
          severity: critical
```

### Logging Strategy

```typescript
// Structured logging (JSON format)
this.logger.log({
  event: 'telemetry_ingested',
  vehicleId: data.vehicleId,
  timestamp: data.timestamp,
  duration_ms: Date.now() - startTime,
  soc: data.soc,
  efficiency: this.calculateEfficiency(data)
});

// Log levels
// DEBUG: Detailed flow (dev only)
// INFO: Key operations (ingest, query)
// WARN: Degraded performance, low efficiency
// ERROR: Failed operations, exceptions
```

## Future Enhancements

### 1. Stream Processing (Apache Kafka)
- Decouple ingestion from persistence
- Buffer spikes in telemetry
- Enable real-time analytics (Apache Flink)

### 2. Machine Learning
- Anomaly detection (sudden efficiency drop)
- Predictive maintenance (battery degradation)
- Load forecasting (grid demand)

### 3. Multi-Tenancy
- Separate databases per fleet operator
- Row-level security with Postgres RLS
- Tenant-aware caching

### 4. GraphQL API
- Flexible client queries
- Reduced over-fetching
- Subscriptions for real-time updates

---

**Last Updated**: 2024-02-08  
**Version**: 1.0.0
