import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('vehicle_telemetry_history')
@Index('idx_vehicle_history_vehicle_timestamp', ['vehicleId', 'timestamp'])
export class VehicleTelemetryHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'vehicle_id', type: 'varchar', length: 50 })
  vehicleId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  soc: number;

  @Column({
    name: 'kwh_delivered_dc',
    type: 'decimal',
    precision: 10,
    scale: 4,
  })
  kwhDeliveredDc: number;

  @Column({ name: 'battery_temp', type: 'decimal', precision: 5, scale: 2 })
  batteryTemp: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'ingested_at' })
  ingestedAt: Date;
}
