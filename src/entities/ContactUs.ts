import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Contact_Us {
    @PrimaryGeneratedColumn()
    contact_id: number;

    @Column({ length: 255 })
    name: string;

    @Column()
    contact_number: string;

    @Column({ length: 255 })
    email: string;

    @Column({ type: 'text' })
    query: string;

    @Column({ type: 'text', nullable: true })
    response: string;

    @Column({ type: 'boolean', default: false })
    is_response: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}