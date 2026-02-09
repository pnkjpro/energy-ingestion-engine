import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('meter_current_status')
export class MeterCurrentStatus {
  @PrimaryColumn({ name: 'meter_id', type: 'varchar', length: 50 })
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

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
