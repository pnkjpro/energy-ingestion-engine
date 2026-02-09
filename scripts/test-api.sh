#!/bin/bash

# API Test Examples for Energy Ingestion Engine
# Make sure the server is running before executing these tests

BASE_URL="http://localhost:3000"

echo "==================================="
echo "Energy Ingestion Engine - API Tests"
echo "==================================="
echo ""

# Test 1: Ingest single meter reading
echo "Test 1: Ingest meter telemetry"
curl -X POST "${BASE_URL}/v1/ingest/meter" \
  -H "Content-Type: application/json" \
  -d '{
    "meterId": "METER-001",
    "kwhConsumedAc": 125.5432,
    "voltage": 240.5,
    "timestamp": "2024-02-08T10:30:00Z"
  }'
echo -e "\n"

# Test 2: Ingest single vehicle reading
echo "Test 2: Ingest vehicle telemetry"
curl -X POST "${BASE_URL}/v1/ingest/vehicle" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "VEHICLE-001",
    "soc": 85.5,
    "kwhDeliveredDc": 105.2134,
    "batteryTemp": 32.5,
    "timestamp": "2024-02-08T10:30:00Z"
  }'
echo -e "\n"

# Test 3: Batch ingest meter data
echo "Test 3: Batch ingest meter telemetry"
curl -X POST "${BASE_URL}/v1/ingest/meter/batch" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "meterId": "METER-001",
      "kwhConsumedAc": 125.5,
      "voltage": 240.2,
      "timestamp": "2024-02-08T10:31:00Z"
    },
    {
      "meterId": "METER-001",
      "kwhConsumedAc": 126.1,
      "voltage": 240.8,
      "timestamp": "2024-02-08T10:32:00Z"
    }
  ]'
echo -e "\n"

# Test 4: Get analytics
echo "Test 4: Get 24-hour performance analytics"
curl -X GET "${BASE_URL}/v1/analytics/performance/VEHICLE-001" \
  -H "Content-Type: application/json"
echo -e "\n"

# Test 5: Swagger documentation
echo "Test 5: Access Swagger documentation"
echo "Open in browser: ${BASE_URL}/api/docs"
echo ""

echo "==================================="
echo "All tests completed!"
echo "==================================="
