// Тестовый скрипт для демонстрации checkpoint системы
const Redis = require('ioredis');

const redis = new Redis({
    host: process.env.TIMEWEB_REDIS_HOST,
    port: process.env.TIMEWEB_REDIS_PORT ? parseInt(process.env.TIMEWEB_REDIS_PORT) : 6379,
    username: process.env.TIMEWEB_REDIS_USERNAME || undefined,
    password: process.env.TIMEWEB_REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
});

async function demonstrateCheckpointSystem() {
    const testVideoId = 'test-checkpoint-' + Date.now();
    const testUserId = 'test-user-123';
    
    console.log('🧪 Демонстрируем checkpoint систему...');
    console.log(`📹 Тестовый VideoId: ${testVideoId}`);
    
    try {
        // 1. Начинаем с пустого checkpoint
        console.log('\n1️⃣ Начальное состояние (нет checkpoint)');
        let checkpoint = await getVideoCheckpoint(testVideoId);
        console.log('Checkpoint:', checkpoint);
        console.log('Следующий шаг:', getNextStep(checkpoint));
        
        // 2. Симулируем выполнение шагов с checkpoint'ами
        console.log('\n2️⃣ Выполняем шаги с checkpoint\'ами...');
        
        // Script completed
        await markStepCompleted(testVideoId, testUserId, 'script');
        checkpoint = await getVideoCheckpoint(testVideoId);
        console.log('После script:', checkpoint.completedSteps);
        console.log('Следующий шаг:', getNextStep(checkpoint));
        
        // Images completed
        await markStepCompleted(testVideoId, testUserId, 'images');
        checkpoint = await getVideoCheckpoint(testVideoId);
        console.log('После images:', checkpoint.completedSteps);
        console.log('Следующий шаг:', getNextStep(checkpoint));
        
        // Audio completed
        await markStepCompleted(testVideoId, testUserId, 'audio');
        checkpoint = await getVideoCheckpoint(testVideoId);
        console.log('После audio:', checkpoint.completedSteps);
        console.log('Следующий шаг:', getNextStep(checkpoint));
        
        // 3. Симулируем ошибку на captions
        console.log('\n3️⃣ Симулируем ошибку на шаге captions...');
        await markStepFailed(testVideoId, testUserId, 'captions');
        checkpoint = await getVideoCheckpoint(testVideoId);
        console.log('После ошибки captions:', {
            completedSteps: checkpoint.completedSteps,
            lastFailedStep: checkpoint.lastFailedStep,
            nextStep: getNextStep(checkpoint)
        });
        
        // 4. Симулируем retry - начинается с captions
        console.log('\n4️⃣ Retry начинается с captions (пропуская completed шаги)...');
        console.log('Пропускаем: script ✅, images ✅, audio ✅');
        console.log('Начинаем с: captions (последний failed шаг)');
        
        // Завершаем captions
        await markStepCompleted(testVideoId, testUserId, 'captions');
        checkpoint = await getVideoCheckpoint(testVideoId);
        console.log('После успешного captions:', checkpoint.completedSteps);
        console.log('Следующий шаг:', getNextStep(checkpoint));
        
        // Завершаем render
        await markStepCompleted(testVideoId, testUserId, 'render');
        checkpoint = await getVideoCheckpoint(testVideoId);
        console.log('После render:', checkpoint.completedSteps);
        console.log('Следующий шаг:', getNextStep(checkpoint));
        
        console.log('\n✅ Демонстрация завершена!');
        console.log('\n📊 Результат:');
        console.log('- При ошибке на captions не нужно перегенерировать script, images, audio');
        console.log('- Retry начинается точно с места ошибки');
        console.log('- Экономим время, токены AI и деньги');
        
        // Очищаем через 5 секунд
        setTimeout(async () => {
            await deleteVideoCheckpoint(testVideoId);
            console.log('🧹 Тестовые данные очищены');
            process.exit(0);
        }, 5000);
        
    } catch (error) {
        console.error('❌ Ошибка во время демонстрации:', error);
        process.exit(1);
    }
}

// Вспомогательные функции (копии из redis.ts)
async function getVideoCheckpoint(videoId) {
    try {
        const key = `video_checkpoint:${videoId}`;
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Failed to get video checkpoint:', error);
        return null;
    }
}

async function setVideoCheckpoint(videoId, checkpoint) {
    try {
        const key = `video_checkpoint:${videoId}`;
        await redis.setex(key, 7200, JSON.stringify(checkpoint));
    } catch (error) {
        console.error('Failed to set video checkpoint:', error);
    }
}

async function markStepCompleted(videoId, userId, step) {
    try {
        const checkpoint = await getVideoCheckpoint(videoId) || {
            videoId,
            userId,
            completedSteps: {
                script: false,
                images: false,
                audio: false,
                captions: false,
                render: false
            },
            timestamp: Date.now()
        };

        if (step in checkpoint.completedSteps) {
            checkpoint.completedSteps[step] = true;
            checkpoint.lastCompletedStep = step;
            checkpoint.timestamp = Date.now();
            
            await setVideoCheckpoint(videoId, checkpoint);
            console.log(`✅ Checkpoint: Step '${step}' completed`);
        }
    } catch (error) {
        console.error('Failed to mark step as completed:', error);
    }
}

async function markStepFailed(videoId, userId, step) {
    try {
        const checkpoint = await getVideoCheckpoint(videoId) || {
            videoId,
            userId,
            completedSteps: {
                script: false,
                images: false,
                audio: false,
                captions: false,
                render: false
            },
            timestamp: Date.now()
        };

        checkpoint.lastFailedStep = step;
        checkpoint.timestamp = Date.now();
        
        await setVideoCheckpoint(videoId, checkpoint);
        console.log(`❌ Checkpoint: Step '${step}' failed`);
    } catch (error) {
        console.error('Failed to mark step as failed:', error);
    }
}

function getNextStep(checkpoint) {
    if (!checkpoint) return 'script';
    
    const steps = ['script', 'images', 'audio', 'captions', 'render'];
    const completed = checkpoint.completedSteps;
    
    for (const step of steps) {
        if (!completed[step]) {
            return step;
        }
    }
    
    return 'completed';
}

async function deleteVideoCheckpoint(videoId) {
    try {
        const key = `video_checkpoint:${videoId}`;
        await redis.del(key);
    } catch (error) {
        console.error('Failed to delete video checkpoint:', error);
    }
}

// Запускаем демонстрацию
demonstrateCheckpointSystem();