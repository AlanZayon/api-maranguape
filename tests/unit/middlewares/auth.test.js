/* eslint-disable no-undef */
const { describe, test, expect, beforeEach, afterAll } = require('@jest/globals');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../../../src/middlewares/auth');
const AppError = require('../../../src/utils/AppError');
const httpMocks = require('node-mocks-http');

jest.mock('jsonwebtoken');

describe('auth middleware', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  describe('authenticate', () => {
    test('rejects when cookie is missing', () => {
      const req = httpMocks.createRequest({ cookies: {} });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    test('attaches req.user from valid JWT', () => {
      jwt.verify.mockReturnValue({
        id: 'user1',
        role: 'admin',
        username: 'alice',
        tenantId: 'tenant1',
      });

      const req = httpMocks.createRequest({
        cookies: { authToken: 'valid.token' },
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid.token', 'test-secret');
      expect(req.user).toEqual({
        id: 'user1',
        role: 'admin',
        username: 'alice',
        tenantId: 'tenant1',
      });
      expect(next).toHaveBeenCalledWith();
    });

    test('rejects invalid JWT', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      const req = httpMocks.createRequest({
        cookies: { authToken: 'bad.token' },
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('authorize', () => {
    test('allows matching role', () => {
      const req = httpMocks.createRequest();
      req.user = { role: 'admin' };
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authorize('admin', 'superadmin')(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('rejects wrong role', () => {
      const req = httpMocks.createRequest();
      req.user = { role: 'user' };
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authorize('admin')(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    test('rejects when not authenticated', () => {
      const req = httpMocks.createRequest();
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authorize('admin')(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });
});
