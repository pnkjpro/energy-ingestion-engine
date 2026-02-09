import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AnalyticsService } from '../services/analytics.service';
import { VehiclePerformanceAnalyticsDto } from '../dtos/analytics-response.dto';

@ApiTags('Analytics')
@Controller('v1/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('performance/:vehicleId')
  @ApiOperation({
    summary: 'Get 24-hour performance analytics for a vehicle',
    description:
      'Returns aggregated energy consumption, efficiency ratio, and battery temperature for the specified vehicle over the last 24 hours',
  })
  @ApiParam({
    name: 'vehicleId',
    description: 'Unique vehicle identifier',
    example: 'VEHICLE-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics successfully retrieved',
    type: VehiclePerformanceAnalyticsDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No data found for the specified vehicle',
  })
  async getPerformance(
    @Param('vehicleId') vehicleId: string,
  ): Promise<VehiclePerformanceAnalyticsDto> {
    this.logger.log(`Fetching performance analytics for vehicle: ${vehicleId}`);
    return await this.analyticsService.getVehiclePerformance(vehicleId);
  }
}
