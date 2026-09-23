import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('API foundation', () => {
  it('returns a health response', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('rejects protected resources without a token', async () => {
    const response = await request(app).get('/api/patients');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
