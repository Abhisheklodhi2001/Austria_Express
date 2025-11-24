import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Route } from "../entities/Route";
import { City } from "../entities/City";

@Entity()
export class Route_Stops {
    @PrimaryGeneratedColumn()
    stop_id: number;

    @ManyToOne(() => Route, { nullable: false, onDelete: "CASCADE" })
    route: Route;

    @ManyToOne(() => City, { nullable: false })
    stop_city: City;

    @Column({ type: 'integer', nullable: false })
    stop_order: number;

    @Column({ nullable: true })
    arrival_time: string;

    @Column({ nullable: true })
    stop_time: string;

    @Column({ nullable: true })
    departure_time: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}