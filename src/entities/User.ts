import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    guest_user: string

    @Column({ nullable: true })
    first_name: string;

    @Column({ nullable: true })
    last_name: string;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true, })
    mobile_number: string;

    @Column({ nullable: true })
    show_password: string;

    @Column({ nullable: true })
    password: string;

    @Column({ nullable: true, type: `text` })
    profile_image: string;

    @Column({ nullable: true })
    jwt_token: string;

    @Column({ nullable: true, type: 'varchar', length: 64 })
    reset_password_token: string | null;

    @Column({ type: 'timestamp', nullable: true, default: null })
    reset_password_token_expiry: Date | null;

    @Column({ nullable: true, type: 'varchar', length: 64 })
    verify_token: string | null;

    @Column({ type: 'timestamp', nullable: true, default: null })
    verify_token_expiry: Date | null;

    @Column({ type: 'boolean', default: false })
    is_verified: boolean;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_blocked: boolean;

    @Column({ nullable: true })
    block_reason: string;

    @Column({ nullable: true, default: "traditional" })
    signup_method: string;

    @Column({ nullable: true, default: null })
    stripe_customer_id: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
