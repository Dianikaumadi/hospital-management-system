"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const app_1 = require("../src/app");
(0, vitest_1.describe)('API foundation', () => {
    (0, vitest_1.it)('returns a health response', async () => {
        const response = await (0, supertest_1.default)(app_1.app).get('/health');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.status).toBe('ok');
    });
    (0, vitest_1.it)('rejects protected resources without a token', async () => {
        const response = await (0, supertest_1.default)(app_1.app).get('/api/patients');
        (0, vitest_1.expect)(response.status).toBe(401);
        (0, vitest_1.expect)(response.body.success).toBe(false);
    });
});
