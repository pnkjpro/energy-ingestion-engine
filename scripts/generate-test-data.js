#!/usr/bin/env node

/**
 * Test Data Generator for Energy Ingestion Engine
 * 
 * Usage:
 *   node generate-test-data.js <vehicle-count> <duration-hours>
 * 
 * Example:
 *   node generate-test-data.js 10 24
 *   Generates 24 hours of data for 10 vehicles
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const VEHICLE_COUNT = parseInt(process.argv[2]) || 10;
const DURATION_HOURS = parseInt(process.argv[3]) || 24;
const INTERVAL_MINUTES = 1;

console.log(`Generating test data:`);
console.log(`  Vehicles: ${VEHICLE_COUNT}`);
console.log(`  Duration: ${DURATION_HOURS} hours`);
console.log(`  Interval: ${INTERVAL_MINUTES} minute(s)`);
console.log(`  Total records: ${VEHICLE_COUNT * DURATION_HOURS * 60 / INTERVAL_MINUTES} per stream`);
console.log('');

// Generate realistic telemetry data
function generateMeterData(meterId, timestamp) {
  return {
    meterId,
    kwhConsumedAc: parseFloat((Math.random() * 10 + 100).toFixed(4)), // 100-110 kWh
    voltage: parseFloat((Math.random() * 10 + 235).toFixed(2)), // 235-245V
    timestamp: timestamp.toISOString(),
  };
}

function generateVehicleData(vehicleId, timestamp) {
  return {
    vehicleId,
    soc: parseFloat((Math.random() * 30 + 70).toFixed(2)), // 70-100% SoC
    kwhDeliveredDc: parseFloat((Math.random() * 8 + 85).toFixed(4)), // 85-93 kWh (85-93% efficiency)
    batteryTemp: parseFloat((Math.random() * 10 + 28).toFixed(2)), // 28-38°C
    timestamp: timestamp.toISOString(),
  };
}

async function sendBatch(endpoint, data) {
  try {
    const response = await axios.post(`${API_BASE_URL}/v1/ingest/${endpoint}/batch`, data);
    return response.data;
  } catch (error) {
    console.error(`Error sending batch to ${endpoint}:`, error.message);
    throw error;
  }
}

async function generateAndSendData() {
  const now = new Date();
  const startTime = new Date(now.getTime() - DURATION_HOURS * 60 * 60 * 1000);
  
  const totalIntervals = (DURATION_HOURS * 60) / INTERVAL_MINUTES;
  const batchSize = 100; // Send in batches of 100
  
  let meterBatch = [];
  let vehicleBatch = [];
  let totalMeterRecords = 0;
  let totalVehicleRecords = 0;

  for (let interval = 0; interval < totalIntervals; interval++) {
    const timestamp = new Date(startTime.getTime() + interval * INTERVAL_MINUTES * 60 * 1000);
    
    for (let i = 1; i <= VEHICLE_COUNT; i++) {
      const vehicleId = `VEHICLE-${String(i).padStart(3, '0')}`;
      const meterId = `METER-${String(i).padStart(3, '0')}`;
      
      meterBatch.push(generateMeterData(meterId, timestamp));
      vehicleBatch.push(generateVehicleData(vehicleId, timestamp));
    }

    // Send batches when they reach the batch size
    if (meterBatch.length >= batchSize) {
      await sendBatch('meter', meterBatch);
      totalMeterRecords += meterBatch.length;
      console.log(`✓ Sent meter batch: ${totalMeterRecords} records`);
      meterBatch = [];
    }

    if (vehicleBatch.length >= batchSize) {
      await sendBatch('vehicle', vehicleBatch);
      totalVehicleRecords += vehicleBatch.length;
      console.log(`✓ Sent vehicle batch: ${totalVehicleRecords} records`);
      vehicleBatch = [];
    }
  }

  // Send remaining data
  if (meterBatch.length > 0) {
    await sendBatch('meter', meterBatch);
    totalMeterRecords += meterBatch.length;
    console.log(`✓ Sent final meter batch: ${totalMeterRecords} records`);
  }

  if (vehicleBatch.length > 0) {
    await sendBatch('vehicle', vehicleBatch);
    totalVehicleRecords += vehicleBatch.length;
    console.log(`✓ Sent final vehicle batch: ${totalVehicleRecords} records`);
  }

  console.log('');
  console.log('Data generation complete!');
  console.log(`Total meter records: ${totalMeterRecords}`);
  console.log(`Total vehicle records: ${totalVehicleRecords}`);
}

generateAndSendData().catch(console.error);
