#!/usr/bin/env node
import { testRedisConnection } from '../lib/redis.ts';

console.log('Testing Redis connection...');

testRedisConnection()
  .then(success => {
    if (success) {
      console.log('✅ Redis connection successful!');
      process.exit(0);
    } else {
      console.log('❌ Redis connection failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Redis connection test error:', error);
    process.exit(1);
  });