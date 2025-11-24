import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Route } from './Route';

@Entity()
export class RouteClosure {
    @PrimaryGeneratedColumn()
    closure_id: number;

    @ManyToOne(() => Route, { nullable: false, onDelete: "CASCADE" })
    route: Route;

    @Column({ type: 'date', nullable: false })
    from_date: Date;

    @Column({ type: 'date', nullable: false })
    to_date: Date;

    @Column({ type: 'text', nullable: true })
    closure_reason: string;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}