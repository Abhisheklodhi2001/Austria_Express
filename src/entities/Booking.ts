import { Entity, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Route } from './Route';
import { City } from './City';

@Entity()
export class Booking {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    booking_number: string;

    @ManyToOne(() => Route, { nullable: false, onDelete: "CASCADE" })
    route: Route;

    @ManyToOne(() => City, { nullable: false })
    from: City;

    @ManyToOne(() => City, { nullable: false })
    to: City;

    @Column({ nullable: false })
    travel_date: string;

    @Column()
    departure_time: string;

    @Column()
    arrival_time: String;

    @Column({ type: 'enum', enum: ['Pending', 'Confirmed', 'Cancelled'], default: 'Pending' })
    booking_status: string;

    @Column()
    payment_method: string;

    @Column({ type: 'boolean', default: false })
    payment_status: boolean;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    subtotal: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    tax: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    total: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    deposit: number;

    @Column({ type: 'boolean', default: false })
    is_refundable: boolean;

    @Column({ nullable: false })
    first_name: string;

    @Column({ nullable: false })
    last_name: string;

    @Column({ nullable: false })
    phone: string;

    @Column({ nullable: false })
    email: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ nullable: false })
    booking_user_id: number;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @Column({ type: 'boolean', default: false })
    is_return_trip: boolean;

    // 🔥 NEW FIELD — onward booking id (only if this is return)
    @Column({ type: 'int', nullable: true })
    parent_booking_id: number | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
