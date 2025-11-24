import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Admin {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    name: string;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true, })
    mobile_number: string;

    @Column({ nullable: true })
    show_password: string;

    @Column({ nullable: true })
    password: string;

    @Column({ nullable: true })
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

    @Column({ nullable: true })
    signup_method: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
