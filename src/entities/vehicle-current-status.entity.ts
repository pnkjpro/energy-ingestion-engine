import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vehicle_current_status')
export class VehicleCurrentStatus {
  @PrimaryColumn({ name: 'vehicle_id', type: 'varchar', length: 50 })
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

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
