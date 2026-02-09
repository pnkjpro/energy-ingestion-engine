import { IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MeterTelemetryDto {
  @ApiProperty({
    description: 'Unique identifier for the smart meter',
    example: 'METER-001',
  })
  @IsString()
  meterId: string;

  @ApiProperty({
    description: 'AC power consumed from grid in kWh',
    example: 125.5432,
  })
  @IsNumber()
  @Min(0)
  kwhConsumedAc: number;

  @ApiProperty({
    description: 'Voltage reading in Volts',
    example: 240.5,
  })
  @IsNumber()
  @Min(0)
  voltage: number;

  @ApiProperty({
    description: 'Timestamp of the reading (ISO 8601)',
    example: '2024-02-08T10:30:00Z',
  })
  @IsDateString()
  timestamp: string;
}
