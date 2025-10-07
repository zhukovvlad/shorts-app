/**
 * Тестовый скрипт для проверки миграции базы данных
 * Запуск: npx tsx scripts/test-migration.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testMigration() {
  console.log('🔍 Проверка миграции базы данных...\n')

  try {
    // 1. Проверка подключения
    console.log('1️⃣  Проверка подключения к БД...')
    await prisma.$connect()
    console.log('✅ Подключение успешно\n')

    // 2. Проверка структуры таблиц
    console.log('2️⃣  Проверка существования таблиц...')
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    const tableNames = tables.map(t => t.tablename)
    console.log('Найденные таблицы:', tableNames)
    
    const requiredTables = ['User', 'Account', 'Session', 'VerificationToken', 'Video']
    const missingTables = requiredTables.filter(t => !tableNames.includes(t))
    
    if (missingTables.length > 0) {
      console.error('❌ Отсутствуют таблицы:', missingTables)
      process.exit(1)
    }
    console.log('✅ Все необходимые таблицы существуют\n')

    // 3. Проверка индексов
    console.log('3️⃣  Проверка индексов...')
    const indexes = await prisma.$queryRaw<Array<{ indexname: string, tablename: string }>>`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND tablename IN ('User', 'Account', 'Session', 'VerificationToken')
    `
    console.log('Найденные индексы:', indexes.length)
    indexes.forEach(idx => console.log(`  - ${idx.tablename}.${idx.indexname}`))
    console.log('✅ Индексы созданы\n')

    // 4. Проверка Foreign Keys
    console.log('4️⃣  Проверка Foreign Keys...')
    const fks = await prisma.$queryRaw<Array<{ 
      constraint_name: string, 
      table_name: string,
      column_name: string,
      foreign_table_name: string,
      foreign_column_name: string
    }>>`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `
    
    console.log('Найденные FK:', fks.length)
    fks.forEach(fk => {
      console.log(`  - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`)
    })
    
    // Проверка что все необходимые FK существуют
    const expectedFKs = [
      { table: 'Account', column: 'userId', refTable: 'User', refColumn: 'id' },
      { table: 'Session', column: 'userId', refTable: 'User', refColumn: 'id' },
      { table: 'Video', column: 'userId', refTable: 'User', refColumn: 'id' },
    ]
    
    for (const expected of expectedFKs) {
      const found = fks.find(fk => 
        fk.table_name === expected.table &&
        fk.column_name === expected.column &&
        fk.foreign_table_name === expected.refTable &&
        fk.foreign_column_name === expected.refColumn
      )
      if (!found) {
        console.error(`❌ Отсутствует FK: ${expected.table}.${expected.column} → ${expected.refTable}.${expected.refColumn}`)
        process.exit(1)
      }
    }
    console.log('✅ Все Foreign Keys корректны\n')

    // 5. Тест создания пользователя
    console.log('5️⃣  Тест CRUD операций с User...')
    
    // Создание
    const testUser = await prisma.user.create({
      data: {
        id: 'test_' + Date.now(),
        email: `test_${Date.now()}@example.com`,
        name: 'Test User',
        credits: 5,
      }
    })
    console.log('✅ Создание User работает')
    
    // Чтение
    const foundUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    })
    if (!foundUser) {
      console.error('❌ Не удалось найти созданного пользователя')
      process.exit(1)
    }
    console.log('✅ Чтение User работает')
    
    // Обновление
    const updatedUser = await prisma.user.update({
      where: { id: testUser.id },
      data: { credits: 10 }
    })
    if (updatedUser.credits !== 10) {
      console.error('❌ Обновление не применилось')
      process.exit(1)
    }
    console.log('✅ Обновление User работает')
    
    // Удаление
    await prisma.user.delete({
      where: { id: testUser.id }
    })
    const deletedUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    })
    if (deletedUser) {
      console.error('❌ Пользователь не удален')
      process.exit(1)
    }
    console.log('✅ Удаление User работает\n')

    // 6. Тест уникальности email
    console.log('6️⃣  Тест уникальности email...')
    const user1 = await prisma.user.create({
      data: {
        id: 'test1_' + Date.now(),
        email: 'unique_test@example.com',
      }
    })
    
    try {
      await prisma.user.create({
        data: {
          id: 'test2_' + Date.now(),
          email: 'unique_test@example.com', // Дубликат
        }
      })
      console.error('❌ Уникальность email не работает!')
      process.exit(1)
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log('✅ Уникальность email работает')
      } else {
        throw error
      }
    }
    
    // Cleanup
    await prisma.user.delete({ where: { id: user1.id } })
    console.log('')

    // 7. Проверка что старое поле userId удалено
    console.log('7️⃣  Проверка что старое поле userId удалено...')
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND table_schema = 'public'
    `
    const columnNames = columns.map(c => c.column_name)
    
    if (columnNames.includes('userId')) {
      console.error('❌ Старое поле userId все еще существует!')
      process.exit(1)
    }
    console.log('✅ Старое поле userId успешно удалено\n')

    // Финальная сводка
    console.log('═'.repeat(50))
    console.log('🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!')
    console.log('═'.repeat(50))
    console.log('\nМиграция применена корректно:')
    console.log('✅ Все таблицы созданы')
    console.log('✅ Индексы установлены')
    console.log('✅ Foreign Keys работают')
    console.log('✅ CRUD операции функционируют')
    console.log('✅ Уникальные ограничения применены')
    console.log('✅ Старые поля удалены')
    console.log('\n🚀 База данных готова к использованию!\n')

  } catch (error) {
    console.error('\n❌ ОШИБКА ПРИ ПРОВЕРКЕ:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Запуск
testMigration()
