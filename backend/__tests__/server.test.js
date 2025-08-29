const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Mock the environment variables to avoid needing actual API keys
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use dynamic port for testing

// Mock external dependencies to avoid actual API calls
jest.mock('openai');
jest.mock('@google/generative-ai');

// Import the server after setting up mocks
const server = require('../server');

describe('Survey Backend API', () => {
  afterAll(() => {
    // Clean up server if it's running
    if (server && server.close) {
      server.close();
    }
  });

  test('GET /health should return status ok', async () => {
    const response = await request(server)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('sessionsActive');
    expect(typeof response.body.timestamp).toBe('string');
    expect(typeof response.body.sessionsActive).toBe('number');
  });

  test('POST /api/session should generate session ID', async () => {
    const response = await request(server)
      .post('/api/session')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('sessionId');
    expect(typeof response.body.sessionId).toBe('string');
    expect(response.body.sessionId.length).toBeGreaterThan(0);
  });

  test('GET /api/config should return configuration', async () => {
    const response = await request(server)
      .get('/api/config')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('config');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body.config).toHaveProperty('validationTrigger');
    expect(response.body.config).toHaveProperty('selectedModel');
    expect(response.body.config).toHaveProperty('questions');
  });

  test('GET /api/prompt should return LLM prompt configuration', async () => {
    const response = await request(server)
      .get('/api/prompt')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('systemPrompt');
    expect(response.body).toHaveProperty('userPrompt');
    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.systemPrompt).toBe('string');
    expect(typeof response.body.userPrompt).toBe('string');
  });

  test('POST /api/validate should require question and answer', async () => {
    const response = await request(server)
      .post('/api/validate')
      .send({})
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required fields');
    expect(response.body).toHaveProperty('message', 'question and answer are required');
  });
});