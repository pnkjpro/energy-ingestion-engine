import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleTelemetryHistory } from '../entities/vehicle-telemetry-history.entity';
import { MeterTelemetryHistory } from '../entities/meter-telemetry-history.entity';
import { VehiclePerformanceAnalyticsDto } from '../dtos/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(VehicleTelemetryHistory)
    private vehicleHistoryRepo: Repository<VehicleTelemetryHistory>,
    @InjectRepository(MeterTelemetryHistory)
    private meterHistoryRepo: Repository<MeterTelemetryHistory>,
  ) {}

  /**
   * Get 24-hour performance analytics for a vehicle
   * OPTIMIZED: Uses indexed queries to avoid full table scans
   * Strategy: Composite index on (vehicle_id, timestamp) enables efficient range queries
   */
  async getVehiclePerformance(
    vehicleId: string,
  ): Promise<VehiclePerformanceAnalyticsDto> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    this.logger.debug(
      `Fetching analytics for ${vehicleId} from ${oneDayAgo.toISOString()} to ${now.toISOString()}`,
    );

    // Query 1: Get vehicle-side data (DC delivered)
    // Uses index: idx_vehicle_history_vehicle_timestamp
    const vehicleData = await this.vehicleHistoryRepo
      .createQueryBuilder('v')
      .select('SUM(v.kwhDeliveredDc)', 'totalDc')
      .addSelect('AVG(v.batteryTemp)', 'avgTemp')
      .addSelect('COUNT(*)', 'count')
      .where('v.vehicleId = :vehicleId', { vehicleId })
      .andWhere('v.timestamp >= :start', { start: oneDayAgo })
      .andWhere('v.timestamp <= :end', { end: now })
      .getRawOne();

    if (!vehicleData || vehicleData.count === '0') {
      throw new NotFoundException(
        `No data found for vehicle ${vehicleId} in the last 24 hours`,
      );
    }

    // Query 2: Get meter-side data (AC consumed)
    // Note: In a real system, you'd need a vehicle-to-meter mapping table
    // For this assignment, we assume meterId = vehicleId for correlation
    const meterId = vehicleId; // Simplified correlation

    // Uses index: idx_meter_history_meter_timestamp
    const meterData = await this.meterHistoryRepo
      .createQueryBuilder('m')
      .select('SUM(m.kwhConsumedAc)', 'totalAc')
      .where('m.meterId = :meterId', { meterId })
      .andWhere('m.timestamp >= :start', { start: oneDayAgo })
      .andWhere('m.timestamp <= :end', { end: now })
      .getRawOne();

    const totalEnergyDeliveredDc = parseFloat(vehicleData.totalDc) || 0;
    const totalEnergyConsumedAc = parseFloat(meterData?.totalAc) || 0;
    const avgBatteryTemp = parseFloat(vehicleData.avgTemp) || 0;
    const dataPointsAnalyzed = parseInt(vehicleData.count) || 0;

    // Calculate efficiency ratio (DC/AC)
    // Expected: 0.80-0.95 for healthy systems
    let efficiencyRatio = 0;
    if (totalEnergyConsumedAc > 0) {
      efficiencyRatio = totalEnergyDeliveredDc / totalEnergyConsumedAc;
    }

    // Determine health status based on efficiency
    const healthStatus = this.calculateHealthStatus(
      efficiencyRatio,
      dataPointsAnalyzed,
    );

    return {
      vehicleId,
      periodStart: oneDayAgo.toISOString(),
      periodEnd: now.toISOString(),
      totalEnergyConsumedAc,
      totalEnergyDeliveredDc,
      efficiencyRatio: Math.round(efficiencyRatio * 10000) / 10000, // 4 decimal places
      avgBatteryTemp: Math.round(avgBatteryTemp * 100) / 100, // 2 decimal places
      dataPointsAnalyzed,
      healthStatus,
    };
  }

  /**
   * Determine system health based on efficiency ratio
   * Industry standards:
   * - >0.90: Excellent
   * - 0.85-0.90: Normal
   * - 0.75-0.85: Warning (potential degradation)
   * - <0.75: Critical (hardware fault likely)
   */
  private calculateHealthStatus(
    efficiency: number,
    dataPoints: number,
  ): string {
    if (dataPoints < 10) {
      return 'INSUFFICIENT_DATA';
    }

    if (efficiency >= 0.9) {
      return 'EXCELLENT';
    } else if (efficiency >= 0.85) {
      return 'NORMAL';
    } else if (efficiency >= 0.75) {
      return 'WARNING';
    } else {
      return 'CRITICAL';
    }
  }

  /**
   * Alternative optimized query using materialized views
   * This would be even faster for common queries but requires periodic refresh
   * Uncomment when materialized views are in use
   */
  /*
  async getVehiclePerformanceFast(
    vehicleId: string,
  ): Promise<VehiclePerformanceAnalyticsDto> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Query pre-aggregated hourly data instead of raw telemetry
    const result = await this.dataSource.query(
      `
      SELECT 
        SUM(total_kwh_delivered_dc) as total_dc,
        AVG(avg_battery_temp) as avg_temp,
        SUM(reading_count) as count
      FROM vehicle_hourly_analytics
      WHERE vehicle_id = $1
        AND hour >= $2
        AND hour <= $3
      `,
      [vehicleId, oneDayAgo, now],
    );

    // Similar processing as above...
  }
  */
}
