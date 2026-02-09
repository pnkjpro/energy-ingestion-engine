import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MeterCurrentStatus } from '../entities/meter-current-status.entity';
import { VehicleCurrentStatus } from '../entities/vehicle-current-status.entity';
import { MeterTelemetryHistory } from '../entities/meter-telemetry-history.entity';
import { VehicleTelemetryHistory } from '../entities/vehicle-telemetry-history.entity';
import { MeterTelemetryDto } from '../dtos/meter-telemetry.dto';
import { VehicleTelemetryDto } from '../dtos/vehicle-telemetry.dto';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(MeterCurrentStatus)
    private meterStatusRepo: Repository<MeterCurrentStatus>,
    @InjectRepository(VehicleCurrentStatus)
    private vehicleStatusRepo: Repository<VehicleCurrentStatus>,
    @InjectRepository(MeterTelemetryHistory)
    private meterHistoryRepo: Repository<MeterTelemetryHistory>,
    @InjectRepository(VehicleTelemetryHistory)
    private vehicleHistoryRepo: Repository<VehicleTelemetryHistory>,
    private dataSource: DataSource,
  ) {}

  /**
   * Ingest meter telemetry with dual-path strategy:
   * 1. UPSERT to operational store (hot data)
   * 2. INSERT to historical store (cold data)
   */
  async ingestMeterTelemetry(data: MeterTelemetryDto): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Path 1: UPSERT to current status (hot data)
      // This ensures dashboard queries don't scan millions of rows
      await queryRunner.manager.upsert(
        MeterCurrentStatus,
        {
          meterId: data.meterId,
          kwhConsumedAc: data.kwhConsumedAc,
          voltage: data.voltage,
          lastUpdated: new Date(data.timestamp),
        },
        ['meterId'], // Conflict target
      );

      // Path 2: INSERT to historical store (cold data)
      // Append-only for audit trail and analytics
      await queryRunner.manager.insert(MeterTelemetryHistory, {
        meterId: data.meterId,
        kwhConsumedAc: data.kwhConsumedAc,
        voltage: data.voltage,
        timestamp: new Date(data.timestamp),
      });

      await queryRunner.commitTransaction();
      this.logger.debug(`Meter telemetry ingested: ${data.meterId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to ingest meter telemetry: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Ingest vehicle telemetry with dual-path strategy:
   * 1. UPSERT to operational store (hot data)
   * 2. INSERT to historical store (cold data)
   */
  async ingestVehicleTelemetry(data: VehicleTelemetryDto): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Path 1: UPSERT to current status (hot data)
      await queryRunner.manager.upsert(
        VehicleCurrentStatus,
        {
          vehicleId: data.vehicleId,
          soc: data.soc,
          kwhDeliveredDc: data.kwhDeliveredDc,
          batteryTemp: data.batteryTemp,
          lastUpdated: new Date(data.timestamp),
        },
        ['vehicleId'], // Conflict target
      );

      // Path 2: INSERT to historical store (cold data)
      await queryRunner.manager.insert(VehicleTelemetryHistory, {
        vehicleId: data.vehicleId,
        soc: data.soc,
        kwhDeliveredDc: data.kwhDeliveredDc,
        batteryTemp: data.batteryTemp,
        timestamp: new Date(data.timestamp),
      });

      await queryRunner.commitTransaction();
      this.logger.debug(`Vehicle telemetry ingested: ${data.vehicleId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to ingest vehicle telemetry: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Batch ingestion for high-throughput scenarios
   * Optimized for 14.4M records daily (10K devices × 1440 minutes)
   */
  async ingestMeterBatch(data: MeterTelemetryDto[]): Promise<void> {
    if (data.length === 0) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Batch UPSERT for current status
      for (const item of data) {
        await queryRunner.manager.upsert(
          MeterCurrentStatus,
          {
            meterId: item.meterId,
            kwhConsumedAc: item.kwhConsumedAc,
            voltage: item.voltage,
            lastUpdated: new Date(item.timestamp),
          },
          ['meterId'],
        );
      }

      // Batch INSERT for historical data
      const historyData = data.map((item) => ({
        meterId: item.meterId,
        kwhConsumedAc: item.kwhConsumedAc,
        voltage: item.voltage,
        timestamp: new Date(item.timestamp),
      }));

      await queryRunner.manager.insert(MeterTelemetryHistory, historyData);

      await queryRunner.commitTransaction();
      this.logger.log(`Batch ingested ${data.length} meter records`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to batch ingest meter data: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Batch ingestion for vehicle telemetry
   */
  async ingestVehicleBatch(data: VehicleTelemetryDto[]): Promise<void> {
    if (data.length === 0) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Batch UPSERT for current status
      for (const item of data) {
        await queryRunner.manager.upsert(
          VehicleCurrentStatus,
          {
            vehicleId: item.vehicleId,
            soc: item.soc,
            kwhDeliveredDc: item.kwhDeliveredDc,
            batteryTemp: item.batteryTemp,
            lastUpdated: new Date(item.timestamp),
          },
          ['vehicleId'],
        );
      }

      // Batch INSERT for historical data
      const historyData = data.map((item) => ({
        vehicleId: item.vehicleId,
        soc: item.soc,
        kwhDeliveredDc: item.kwhDeliveredDc,
        batteryTemp: item.batteryTemp,
        timestamp: new Date(item.timestamp),
      }));

      await queryRunner.manager.insert(VehicleTelemetryHistory, historyData);

      await queryRunner.commitTransaction();
      this.logger.log(`Batch ingested ${data.length} vehicle records`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to batch ingest vehicle data: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
