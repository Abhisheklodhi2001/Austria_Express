import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class ScheduleChanges {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 255 })
    heading: string;

    @Column({ type: "text" })
    details: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @Column({ default: false })
    is_deleted: boolean;
}
