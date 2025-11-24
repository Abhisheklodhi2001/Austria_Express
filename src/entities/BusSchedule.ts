import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Bus } from './Bus';
import { Route } from './Route';

@Entity()
export class BusSchedule {
    @PrimaryGeneratedColumn()
    schedule_id: number;

    @ManyToOne(() => Bus, { nullable: false, onDelete: 'CASCADE' })
    bus: Bus;

    @ManyToOne(() => Route, { nullable: false, onDelete: 'CASCADE' })
    route: Route;

    @Column({ type: 'boolean', default: true })
    available: boolean;

    @Column({ type: 'date', nullable: true })
    from: Date;

    @Column({ type: 'date', nullable: true })
    to: Date;

    @Column({ type: 'enum', enum: ['Daily', 'Weekly', 'Custom'], default: 'Daily' })
    recurrence_pattern: string;

    @Column({ nullable: true })
    days_of_week: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}