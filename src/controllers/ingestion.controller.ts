import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IngestionService } from '../services/ingestion.service';
import { MeterTelemetryDto } from '../dtos/meter-telemetry.dto';
import { VehicleTelemetryDto } from '../dtos/vehicle-telemetry.dto';

@ApiTags('Ingestion')
@Controller('v1/ingest')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestionService: IngestionService) {}

  @Post('meter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest meter telemetry data' })
  @ApiResponse({
    status: 201,
    description: 'Meter telemetry successfully ingested',
  })
  @ApiResponse({ status: 400, description: 'Invalid data format' })
  async ingestMeter(@Body() data: MeterTelemetryDto): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`Ingesting meter data: ${data.meterId}`);
    await this.ingestionService.ingestMeterTelemetry(data);
    return {
      success: true,
      message: `Meter telemetry for ${data.meterId} ingested successfully`,
    };
  }

  @Post('vehicle')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest vehicle telemetry data' })
  @ApiResponse({
    status: 201,
    description: 'Vehicle telemetry successfully ingested',
  })
  @ApiResponse({ status: 400, description: 'Invalid data format' })
  async ingestVehicle(@Body() data: VehicleTelemetryDto): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`Ingesting vehicle data: ${data.vehicleId}`);
    await this.ingestionService.ingestVehicleTelemetry(data);
    return {
      success: true,
      message: `Vehicle telemetry for ${data.vehicleId} ingested successfully`,
    };
  }

  @Post('meter/batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Batch ingest meter telemetry data' })
  @ApiResponse({
    status: 201,
    description: 'Meter telemetry batch successfully ingested',
  })
  async ingestMeterBatch(@Body() data: MeterTelemetryDto[]): Promise<{
    success: boolean;
    message: string;
    count: number;
  }> {
    this.logger.log(`Batch ingesting ${data.length} meter records`);
    await this.ingestionService.ingestMeterBatch(data);
    return {
      success: true,
      message: 'Meter telemetry batch ingested successfully',
      count: data.length,
    };
  }

  @Post('vehicle/batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Batch ingest vehicle telemetry data' })
  @ApiResponse({
    status: 201,
    description: 'Vehicle telemetry batch successfully ingested',
  })
  async ingestVehicleBatch(@Body() data: VehicleTelemetryDto[]): Promise<{
    success: boolean;
    message: string;
    count: number;
  }> {
    this.logger.log(`Batch ingesting ${data.length} vehicle records`);
    await this.ingestionService.ingestVehicleBatch(data);
    return {
      success: true,
      message: 'Vehicle telemetry batch ingested successfully',
      count: data.length,
    };
  }
}
