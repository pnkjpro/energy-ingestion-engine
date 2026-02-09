# Quick Start Guide - Energy Ingestion Engine

## 🚀 Get Started in 5 Minutes

### Step 1: Start the System
```bash
# Navigate to project directory
cd energy-ingestion-engine

# Start all services (PostgreSQL + API)
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                      STATUS    PORTS
energy-ingestion-db       Up        0.0.0.0:5432->5432/tcp
energy-ingestion-app      Up        0.0.0.0:3000->3000/tcp
```

### Step 2: Verify Installation
```bash
# Check API health
curl http://localhost:3000/api/docs

# You should see Swagger UI in your browser
```

### Step 3: Generate Test Data
```bash
# Install axios (required for test script)
npm install --no-save axios

# Generate 24 hours of data for 10 vehicles
# This creates 28,800 records (10 vehicles × 1440 minutes × 2 streams)
node scripts/generate-test-data.js 10 24
```

Output will show:
```
Generating test data:
  Vehicles: 10
  Duration: 24 hours
  Interval: 1 minute(s)
  Total records: 14400 per stream

✓ Sent meter batch: 100 records
✓ Sent vehicle batch: 100 records
...
Data generation complete!
Total meter records: 14400
Total vehicle records: 14400
```

### Step 4: Query Analytics
```bash
# Get 24-hour performance for a vehicle
curl http://localhost:3000/v1/analytics/performance/VEHICLE-001 | jq
```

Expected response:
```json
{
  "vehicleId": "VEHICLE-001",
  "periodStart": "2024-02-07T10:30:00Z",
  "periodEnd": "2024-02-08T10:30:00Z",
  "totalEnergyConsumedAc": 2520.5,
  "totalEnergyDeliveredDc": 2142.4,
  "efficiencyRatio": 0.8501,
  "avgBatteryTemp": 33.2,
  "dataPointsAnalyzed": 1440,
  "healthStatus": "NORMAL"
}
```

### Step 5: Test Individual Ingestion
```bash
# Test meter ingestion
curl -X POST http://localhost:3000/v1/ingest/meter \
  -H "Content-Type: application/json" \
  -d '{
    "meterId": "METER-999",
    "kwhConsumedAc": 125.5432,
    "voltage": 240.5,
    "timestamp": "2024-02-08T10:30:00Z"
  }'

# Test vehicle ingestion
curl -X POST http://localhost:3000/v1/ingest/vehicle \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "VEHICLE-999",
    "soc": 85.5,
    "kwhDeliveredDc": 105.2134,
    "batteryTemp": 32.5,
    "timestamp": "2024-02-08T10:30:00Z"
  }'
```

### Step 6: Explore the Database
```bash
# Connect to PostgreSQL
docker exec -it energy-ingestion-db psql -U postgres -d energy_ingestion

# View schema
\dt

# Check hot data (current status)
SELECT * FROM vehicle_current_status LIMIT 5;

# Check cold data (historical)
SELECT COUNT(*) FROM vehicle_telemetry_history;
SELECT COUNT(*) FROM meter_telemetry_history;

# View analytics
SELECT 
  vehicle_id,
  AVG(soc) as avg_soc,
  AVG(battery_temp) as avg_temp
FROM vehicle_telemetry_history
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY vehicle_id
LIMIT 10;
```

## 📊 Understanding the Output

### Health Status Meanings
- **EXCELLENT**: Efficiency ≥ 90% (ideal system performance)
- **NORMAL**: Efficiency 85-90% (expected range)
- **WARNING**: Efficiency 75-85% (potential hardware degradation)
- **CRITICAL**: Efficiency < 75% (likely hardware fault or energy leakage)
- **INSUFFICIENT_DATA**: Less than 10 readings in the period

### Efficiency Calculation
```
Efficiency = DC Energy Delivered / AC Energy Consumed

Example:
  AC Consumed: 125.5 kWh (from grid)
  DC Delivered: 105.2 kWh (to battery)
  Efficiency: 105.2 / 125.5 = 0.838 (83.8%)
  Status: WARNING (below 85%)
```

The difference (125.5 - 105.2 = 20.3 kWh) is lost to:
- Heat generation in AC/DC conversion
- Charger inefficiency
- Cable resistance
- Battery charging inefficiency

## 🛑 Stopping the System
```bash
# Stop all services
docker-compose down

# Stop and remove all data (clean slate)
docker-compose down -v
```

## 🔍 Troubleshooting

### Issue: "Connection refused" on port 3000
**Solution**: Wait for services to fully start
```bash
docker-compose logs -f app
# Wait for: "Application is running on: http://localhost:3000"
```

### Issue: Database initialization errors
**Solution**: Reset the database
```bash
docker-compose down -v
docker-compose up -d
```

### Issue: Test data generation fails
**Solution**: Ensure axios is installed
```bash
npm install --no-save axios
```

### Issue: Analytics returns 404
**Solution**: Generate test data first
```bash
node scripts/generate-test-data.js 1 1  # Minimal test (1 vehicle, 1 hour)
```

## 📚 Next Steps

1. **Explore API Documentation**: http://localhost:3000/api/docs
2. **Read Architecture Guide**: See ARCHITECTURE.md for deep dive
3. **Review Code**: Start with `src/services/ingestion.service.ts`
4. **Run Load Tests**: See README.md for performance benchmarks
5. **Enable Monitoring**: See ARCHITECTURE.md for Prometheus setup

## 🎯 Key Endpoints Summary

| Endpoint | Method | Purpose | Example |
|----------|--------|---------|---------|
| `/v1/ingest/meter` | POST | Single meter reading | Single device update |
| `/v1/ingest/vehicle` | POST | Single vehicle reading | Single device update |
| `/v1/ingest/meter/batch` | POST | Batch meter readings | High-throughput ingestion |
| `/v1/ingest/vehicle/batch` | POST | Batch vehicle readings | High-throughput ingestion |
| `/v1/analytics/performance/:id` | GET | 24-hour analytics | Dashboard, reports |
| `/api/docs` | GET | Swagger UI | API documentation |

## 💡 Pro Tips

1. **Use batch endpoints** for production ingestion (100× faster)
2. **Monitor efficiency trends** to detect hardware issues early
3. **Query hot data** (current_status tables) for real-time dashboards
4. **Query cold data** (history tables) for analytics and reporting
5. **Index usage**: Check EXPLAIN ANALYZE to verify index usage

---

**Ready to scale?** This system handles 10K devices. For 100K+ devices, see ARCHITECTURE.md for horizontal scaling strategies.
