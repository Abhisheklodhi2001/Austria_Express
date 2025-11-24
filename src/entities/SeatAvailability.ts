import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SeatManagement } from './SeatManagement';
import { Route } from './Route';

@Entity()
export class SeatAvailability {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Route, { nullable: false, onDelete: 'CASCADE' })
    route: Route;

    @ManyToOne(() => SeatManagement, { nullable: false, onDelete: 'CASCADE' })
    seat: SeatManagement;

    @Column({ type: 'timestamp', nullable: false })
    travel_date: Date;

    @Column({ type: 'integer', nullable: false })
    from_stop: number;

    @Column({ type: 'integer', nullable: false })
    to_stop: number;

    @Column({ type: 'enum', enum: ['available', 'booked'], default: 'available' })
    status: 'available' | 'booked';

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
