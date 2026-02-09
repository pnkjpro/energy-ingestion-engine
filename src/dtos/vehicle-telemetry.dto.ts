import { IsString, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VehicleTelemetryDto {
  @ApiProperty({
    description: 'Unique identifier for the vehicle',
    example: 'VEHICLE-001',
  })
  @IsString()
  vehicleId: string;

  @ApiProperty({
    description: 'State of Charge (Battery percentage)',
    example: 85.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  soc: number;

  @ApiProperty({
    description: 'DC power delivered to battery in kWh',
    example: 105.2134,
  })
  @IsNumber()
  @Min(0)
  kwhDeliveredDc: number;

  @ApiProperty({
    description: 'Battery temperature in Celsius',
    example: 32.5,
  })
  @IsNumber()
  batteryTemp: number;

  @ApiProperty({
    description: 'Timestamp of the reading (ISO 8601)',
    example: '2024-02-08T10:30:00Z',
  })
  @IsDateString()
  timestamp: string;
}
