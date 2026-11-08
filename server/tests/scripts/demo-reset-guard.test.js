import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { User } from '../../src/models/User.js';
import { demoModeRefusal } from '../../seed/demoMode.js';
import { createUser } from '../helpers/setup.js';

const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));
const WORKFLOW = fileURLToPath(
  new URL('../../../.github/workflows/demo-reset.yml', import.meta.url),
);

describe('demoModeRefusal', () => {
  it('allows the reset only when DEMO_MODE is exactly "true"', () => {
    expect(demoModeRefusal({ DEMO_MODE: 'true' })).toBeNull();
    expect(demoModeRefusal({ DEMO_MODE: ' true ' })).toBeNull();
  });

  it.each([undefined, '', 'false', 'TRUE', 'True', '1', 'yes', 'on', 'truee', 'demo'])(
    'refuses when DEMO_MODE is %j',
    (value) => {
      const refusal = demoModeRefusal({ DEMO_MODE: value });
      expect(refusal).toContain('DEMO_MODE');
      expect(refusal).toContain('Refusing');
    },
  );

  it('refuses when the variable is missing altogether', () => {
    expect(demoModeRefusal({})).toContain('Refusing');
  });
});

/** Runs scripts/seed-demo-reset.js with exactly this environment and collects what it prints. */
function runReset(env) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, ['scripts/seed-demo-reset.js'], {
      cwd: SERVER_DIR,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk) => (output += chunk));
    const timer = setTimeout(() => child.kill(), 60_000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, output, ms: Date.now() - started });
    });
  });
}

const closedPort = () =>
  new Promise((resolve) => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const validEnv = (mongoUri) => ({
  NODE_ENV: 'development',
  MONGODB_URI: mongoUri,
  JWT_ACCESS_SECRET: 'demo-reset-test-access-secret-0000000',
  JWT_REFRESH_SECRET: 'demo-reset-test-refresh-secret-111111',
  CLIENT_ORIGIN: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
});

describe('scripts/seed-demo-reset.js', () => {
  it.each([undefined, '', 'false', '1', 'TRUE'])(
    'refuses, before any database connection, when DEMO_MODE is %j',
    async (value) => {
      // The URI points at a closed port: if the script tried to connect it would fail slowly
      // with a connection error. A refusal is instant and never mentions the database.
      const uri = `mongodb://127.0.0.1:${await closedPort()}/inventory`;
      const env = validEnv(uri);
      if (value !== undefined) env.DEMO_MODE = value;

      const { code, output, ms } = await runReset(env);

      expect(code).toBe(1);
      expect(output).toContain('Refusing to reset demo data');
      expect(output).toContain('DEMO_MODE');
      expect(output).not.toMatch(/ECONNREFUSED|MongoServerSelection|connect/i);
      expect(ms).toBeLessThan(5000);
    },
  );

  describe('with DEMO_MODE=true', () => {
    const dbName = `demo_reset_${randomUUID()}`;
    let uri;

    beforeAll(async () => {
      const base = new URL(inject('mongoUri'));
      base.pathname = `/${dbName}`;
      uri = base.toString();
      await mongoose.connect(uri);
      await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    });

    afterAll(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    it('resets the catalog and keeps every user', async () => {
      const keeper = await createUser({ email: 'keeper@example.com', role: 'admin' });
      const oldCategory = await Category.create({ title: 'Leftover category' });
      await Product.create({
        title: 'Leftover product',
        sku: 'LEFT-1',
        category: oldCategory._id,
        price: 5,
      });

      const { code, output } = await runReset({ ...validEnv(uri), DEMO_MODE: 'true' });

      expect(code, output).toBe(0);
      expect(output).toContain('Demo data reset');
      expect(await User.findById(keeper._id)).not.toBeNull();
      expect(await Category.findOne({ title: 'Leftover category' })).toBeNull();
      expect(await Product.findOne({ sku: 'LEFT-1' })).toBeNull();
      expect(await Product.countDocuments()).toBeGreaterThan(10);
    }, 90_000);
  });
});

describe('the "Reset demo data" workflow', () => {
  const text = readFileSync(WORKFLOW, 'utf8');
  const at = (needle) => text.indexOf(needle);

  it('has a DEMO_MODE check that fails the run unless the variable is exactly true', () => {
    expect(at('DEMO_MODE: ${{ vars.DEMO_MODE }}')).toBeGreaterThan(-1);
    expect(text).toMatch(/if \[ "\$DEMO_MODE" != "true" \]; then[\s\S]*?exit 1/);
  });

  it('runs that check before the code is fetched and before the database is used', () => {
    const guard = at('Check that this is a demo deployment');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(at('actions/checkout'));
    expect(guard).toBeLessThan(at('Install server dependencies'));
    expect(guard).toBeLessThan(at('Reset the demo data'));
    // The guard step itself never reads the database secret.
    expect(text.slice(guard, at('actions/checkout'))).not.toContain('secrets.MONGODB_URI');
  });

  it('still asks for the typed RESET confirmation first', () => {
    expect(at("inputs.confirm != 'RESET'")).toBeGreaterThan(-1);
    expect(at("inputs.confirm != 'RESET'")).toBeLessThan(
      at('Check that this is a demo deployment'),
    );
  });

  it('passes DEMO_MODE to the script, which checks it again on its own', () => {
    const step = text.slice(at('Reset the demo data'));
    expect(step).toContain('DEMO_MODE: ${{ vars.DEMO_MODE }}');
    expect(step).toContain('node scripts/seed-demo-reset.js');
  });
});
