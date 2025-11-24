import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Route } from './Route';
import { City } from "../entities/City";

@Entity({ synchronize: false })
export class TicketType {
    @PrimaryGeneratedColumn()
    ticket_type_id: number;

    @ManyToOne(() => Route, { nullable: false, onDelete: "CASCADE" })
    route: Route;

    @ManyToOne(() => City, { nullable: false, onDelete: "CASCADE" })
    start_point: City;

    @ManyToOne(() => City, { nullable: false, onDelete: "CASCADE" })
    end_point: City

    @Column({ type: 'decimal', precision: 10, scale: 2, default: null })
    Baseprice: number

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
