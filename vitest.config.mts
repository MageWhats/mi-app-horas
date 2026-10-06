import { defineConfig } from 'vitest/config';

// Los cálculos de fechas y horas nocturnas dependen de la zona horaria: las pruebas usan la de Colombia
process.env.TZ = 'America/Bogota';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
