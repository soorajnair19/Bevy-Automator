import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

function getBoolean(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) return defaultValue;
	return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function getNumber(value: string | undefined, defaultValue: number): number {
	if (value === undefined) return defaultValue;
	const n = Number(value);
	return Number.isFinite(n) ? n : defaultValue;
}

export const config = {
	bevy: {
		email: process.env.BEVY_EMAIL ?? '',
		password: process.env.BEVY_PASSWORD ?? '',
		eventUrl: process.env.BEVY_EVENT_URL ?? '',
	},
	playwright: {
		headless: getBoolean(process.env.PW_HEADLESS, true),
		slowMoMs: getNumber(process.env.PW_SLOW_MO_MS, 0),
		authStatePath: process.env.AUTH_STATE_PATH ?? path.resolve('.auth/bevy-auth.json'),
	},
	sheets: {
		googleSheetUrl: process.env.GOOGLE_SHEET_URL ?? '',
	},
	throttle: {
		minDelayMs: getNumber(process.env.MIN_DELAY_MS, 500),
		maxDelayMs: getNumber(process.env.MAX_DELAY_MS, 1000),
		batchSize: getNumber(process.env.BATCH_SIZE, 50),
		retryLimit: getNumber(process.env.RETRY_LIMIT, 2),
	},
};

export function ensureAuthDir() {
	const authDir = path.dirname(config.playwright.authStatePath);
	if (!fs.existsSync(authDir)) {
		fs.mkdirSync(authDir, { recursive: true });
	}
} 