import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';

@Entity()
export class City {
    @PrimaryGeneratedColumn()
    city_id: number;

    @Column()
    city_name: string;

    @Column({ type: 'text', nullable: true })
    city_description: string;

    @Column({ type: 'text' })
    city_address: string;

    @Column({ type: 'decimal', precision: 10, scale: 7 })
    latitude: number;

    @Column({ type: 'decimal', precision: 10, scale: 7 })
    longitude: number;

    @Column({ type: 'boolean', default: false })
    from_ukraine: boolean;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @Column({ nullable: true })
    city_image: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
