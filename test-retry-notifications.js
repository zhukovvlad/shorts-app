// Тестовый скрипт для проверки системы уведомлений о ретраях
const Redis = require('ioredis');

const redis = new Redis({
    host: process.env.UPSTASH_REDIS_HOST,
    port: process.env.UPSTASH_REDIS_PORT ? parseInt(process.env.UPSTASH_REDIS_PORT) : 6379,
    password: process.env.UPSTASH_REDIS_TOKEN || undefined,
    tls: {},
    maxRetriesPerRequest: null,
});

async function testRetryNotifications() {
    const testVideoId = 'test-retry-' + Date.now();
    const testUserId = 'test-user-123';
    
    console.log('🧪 Тестируем систему уведомлений о ретраях...');
    console.log(`📹 Тестовый VideoId: ${testVideoId}`);
    
    try {
        // 1. Симулируем начало обработки
        console.log('\n1️⃣ Начинаем обработку видео...');
        await redis.setex(`video_progress:${testVideoId}`, 3600, JSON.stringify({
            status: 'script',
            step: 'Генерация сценария...',
            timestamp: Date.now(),
            userId: testUserId
        }));
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 2. Симулируем ошибку при генерации субтитров
        console.log('\n2️⃣ Симулируем ошибку при генерации субтитров...');
        await redis.setex(`video_progress:${testVideoId}`, 3600, JSON.stringify({
            status: 'error',
            error: 'Проблема с подключением к внешним сервисам. Попытка 1 из 3',
            lastError: 'TypeError: fetch failed - Connect Timeout Error (attempted address: api.assemblyai.com:443, timeout: 10000ms)',
            retryCount: 1,
            maxRetries: 3,
            timestamp: Date.now(),
            userId: testUserId
        }));
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 3. Симулируем статус ретрая
        console.log('\n3️⃣ Симулируем статус ретрая...');
        await redis.setex(`video_progress:${testVideoId}`, 3600, JSON.stringify({
            status: 'retrying',
            step: 'Повторная попытка 1/3 (шаг: captions)...',
            retryCount: 1,
            maxRetries: 3,
            retryReason: 'Возникла временная ошибка на шаге "captions", пытаемся снова',
            lastError: 'TypeError: fetch failed - Connect Timeout Error',
            currentStepId: 'captions', // Точно указываем какой шаг ретраится
            timestamp: Date.now(),
            userId: testUserId
        }));
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4. Симулируем успешную повторную попытку
        console.log('\n4️⃣ Симулируем возобновление обработки после ретрая...');
        await redis.setex(`video_progress:${testVideoId}`, 3600, JSON.stringify({
            status: 'captions',
            step: 'Генерация субтитров...',
            timestamp: Date.now(),
            userId: testUserId
        }));
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 5. Завершаем успешно
        console.log('\n5️⃣ Завершаем обработку успешно...');
        await redis.setex(`video_progress:${testVideoId}`, 3600, JSON.stringify({
            status: 'completed',
            timestamp: Date.now(),
            userId: testUserId
        }));
        
        console.log('\n✅ Тест завершен! Проверьте UI на предмет отображения уведомлений о ретраях.');
        console.log(`🔗 Для тестирования используйте VideoId: ${testVideoId}`);
        
        // Очищаем через 30 секунд
        setTimeout(async () => {
            await redis.del(`video_progress:${testVideoId}`);
            console.log('🧹 Тестовые данные очищены');
            process.exit(0);
        }, 30000);
        
    } catch (error) {
        console.error('❌ Ошибка во время теста:', error);
        process.exit(1);
    }
}

// Запускаем тест
testRetryNotifications();