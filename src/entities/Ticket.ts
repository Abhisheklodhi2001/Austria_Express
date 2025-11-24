import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';
import { Bus } from './Bus';

@Entity()
export class Ticket {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    booking_reference: string;

    @ManyToOne(() => User, { nullable: false })
    passenger: User;

    @ManyToOne(() => Bus, { nullable: false, onDelete: 'CASCADE' })
    bus: Bus;

    @Column({ type: 'integer' })
    seat_number: number;

    @Column({ type: 'float' })
    price: number;

    @Column({ type: 'boolean', default: false })
    is_checked_in: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
