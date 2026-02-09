import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('meter_telemetry_history')
@Index('idx_meter_history_meter_timestamp', ['meterId', 'timestamp'])
export class MeterTelemetryHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'meter_id', type: 'varchar', length: 50 })
  meterId: string;

  @Column({
    name: 'kwh_consumed_ac',
    type: 'decimal',
    precision: 10,
    scale: 4,
  })
  kwhConsumedAc: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  voltage: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'ingested_at' })
  ingestedAt: Date;
}
