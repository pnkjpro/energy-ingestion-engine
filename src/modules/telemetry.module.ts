import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeterCurrentStatus } from '../entities/meter-current-status.entity';
import { VehicleCurrentStatus } from '../entities/vehicle-current-status.entity';
import { MeterTelemetryHistory } from '../entities/meter-telemetry-history.entity';
import { VehicleTelemetryHistory } from '../entities/vehicle-telemetry-history.entity';
import { IngestionService } from '../services/ingestion.service';
import { AnalyticsService } from '../services/analytics.service';
import { IngestionController } from '../controllers/ingestion.controller';
import { AnalyticsController } from '../controllers/analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeterCurrentStatus,
      VehicleCurrentStatus,
      MeterTelemetryHistory,
      VehicleTelemetryHistory,
    ]),
  ],
  controllers: [IngestionController, AnalyticsController],
  providers: [IngestionService, AnalyticsService],
  exports: [IngestionService, AnalyticsService],
})
export class TelemetryModule {}
