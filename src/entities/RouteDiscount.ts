import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Route } from './Route';

@Entity()
export class RouteDiscount {
    @PrimaryGeneratedColumn()
    discound_id: number;

    @ManyToOne(() => Route, { nullable: false, onDelete: "CASCADE" })
    route: Route;

    @Column({ type: 'date', nullable: false })
    from_date: Date;

    @Column({ type: 'date', nullable: false })
    to_date: Date;

    @Column({ type: 'enum', nullable: false, enum: ['decrease','amount','increase'] })
    discount_type: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    discount_value: string;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}