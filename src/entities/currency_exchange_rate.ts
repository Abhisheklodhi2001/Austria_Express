import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class CurrencyExchangeRate {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 10 })
    from_currency: string;

    @Column({ type: 'varchar', length: 10 })
    to_currency: string;

    @Column('decimal', { precision: 10, scale: 4 })
    rate: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}