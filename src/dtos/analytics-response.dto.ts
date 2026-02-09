import { ApiProperty } from '@nestjs/swagger';

export class VehiclePerformanceAnalyticsDto {
  @ApiProperty({
    description: 'Vehicle identifier',
    example: 'VEHICLE-001',
  })
  vehicleId: string;

  @ApiProperty({
    description: 'Analysis period start timestamp',
    example: '2024-02-07T10:30:00Z',
  })
  periodStart: string;

  @ApiProperty({
    description: 'Analysis period end timestamp',
    example: '2024-02-08T10:30:00Z',
  })
  periodEnd: string;

  @ApiProperty({
    description: 'Total AC power consumed from grid in kWh (meter-side)',
    example: 125.5432,
  })
  totalEnergyConsumedAc: number;

  @ApiProperty({
    description: 'Total DC power delivered to battery in kWh (vehicle-side)',
    example: 105.2134,
  })
  totalEnergyDeliveredDc: number;

  @ApiProperty({
    description: 'Efficiency ratio (DC/AC) - typically 0.80-0.95',
    example: 0.8384,
  })
  efficiencyRatio: number;

  @ApiProperty({
    description: 'Average battery temperature in Celsius',
    example: 32.5,
  })
  avgBatteryTemp: number;

  @ApiProperty({
    description: 'Number of telemetry readings analyzed',
    example: 1440,
  })
  dataPointsAnalyzed: number;

  @ApiProperty({
    description: 'Health assessment based on efficiency',
    example: 'NORMAL',
    enum: ['EXCELLENT', 'NORMAL', 'WARNING', 'CRITICAL', 'INSUFFICIENT_DATA'],
  })
  healthStatus: string;
}
