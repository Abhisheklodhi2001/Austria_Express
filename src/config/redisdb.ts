import Redis from 'ioredis';

export const connect_redis_database = () => {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        db: 0,
    });

    redis.on('connect', () => {
        console.log('Connected to Redis successfully!');
    });

    redis.on('error', (err) => {
        console.error('Redis connection error:', err);
    });
}
