import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class ServiceAlerts {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 255 })
    title: string;

    @Column({ type: "text" })
    description: string;

    @Column({ length: 50 })
    alert_type: string;   // e.g., “warning”, “critical”, “info”

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @Column({ default: false })
    is_deleted: boolean;
}
