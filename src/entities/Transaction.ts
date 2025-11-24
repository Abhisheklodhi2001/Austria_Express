import { Entity, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from './Booking';

@Entity()
export class Transaction {
    @PrimaryGeneratedColumn()
    transaction_id: number;

    @Column({ unique: true })
    transaction_number: string;

    @ManyToOne(() => Booking, { nullable: false, onDelete: "CASCADE" })
    booking: Booking;

    @Column({ nullable: false })
    user: number;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
    amount: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    amount_paid: number;

    @Column({ nullable: true })
    currency: string;

    @Column({ nullable: true })
    payment_method: string;

    @Column({ nullable: true })
    payment_type: string;

    @Column({ default: "pending" })
    status: string;

    @Column({ nullable: true })
    external_transaction_id: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ type: "longtext", nullable: true })
    payment_details: any;

    @Column({ nullable: true })
    ip_address: string;

    @Column({ default: false })
    is_refunded: boolean;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    refunded_amount: number;

    @Column({ nullable: true })
    refunded_at: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
