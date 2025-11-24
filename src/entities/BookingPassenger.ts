import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Booking } from './Booking';

@Entity()
export class BookingPassenger {
    @PrimaryGeneratedColumn()
    passenger_id: number;

    @ManyToOne(() => Booking, { nullable: false, onDelete: "CASCADE" })
    booking: Booking;

    @Column()
    ticket_type: string;

    @Column({ nullable: true })
    selected_seat: number;

    @Column()
    passenger_name: String;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
