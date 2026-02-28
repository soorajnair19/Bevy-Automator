import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import { Attendee, ImportResult } from './types.js';
import { config } from './config.js';

export async function runImporter(params: { 
	attendees: Attendee[]; 
	eventUrl: string; 
	headless: boolean; 
	slowMoMs: number; 
	authStatePath: string;
	credentials?: { email: string; password: string };
}): Promise<ImportResult> {
	const { attendees, eventUrl, headless, slowMoMs, authStatePath, credentials } = params;
	const result: ImportResult = { stats: { total: attendees.length, success: 0, failed: 0, retried: 0 }, successes: [], errors: [] };

	const browser = await chromium.launch({ headless: false, slowMo: slowMoMs }); // Always show browser
	let context: BrowserContext | null = null;
	try {
		const storageStatePath = fs.existsSync(authStatePath) ? authStatePath : undefined;
		context = await browser.newContext(storageStatePath ? { storageState: storageStatePath } : {});
		const page = await context.newPage();

		// Navigate to event page first
		await page.goto(eventUrl, { waitUntil: 'load' });

		// Check if we need to login
		const isLoggedIn = await checkLoginStatus(page);
		if (!isLoggedIn) {
			if (credentials) {
				await loginToBevy(page, credentials);
				// After login, navigate back to the event URL
				console.log('Login successful, navigating to event page...');
				await page.goto(eventUrl, { waitUntil: 'load' });
			} else {
				throw new Error('Not logged in and no credentials provided. Please login manually or provide credentials.');
			}
		}

		// Wait for page to load after login
		await page.waitForLoadState('networkidle');
		console.log('Successfully loaded event page:', eventUrl);

		// Process each attendee
		for (let i = 0; i < attendees.length; i++) {
			const attendee = attendees[i];
			const isLastAttendee = i === attendees.length - 1;
			
			try {
				await addAttendee(page, attendee, isLastAttendee, i);
				result.stats.success++;
				result.successes.push(attendee);
				console.log(`✓ Added attendee ${i + 1}/${attendees.length}: ${attendee.firstName} ${attendee.lastName}`);
			} catch (err: any) {
				result.stats.failed++;
				result.errors.push({ attendee, error: err?.message ?? String(err) });
				console.log(`✗ Failed attendee ${i + 1}/${attendees.length}: ${attendee.firstName} ${attendee.lastName} - ${err?.message}`);
			}

			// Add delay between attendees (except for the last one)
			if (!isLastAttendee) {
				await humanDelay(config.throttle.minDelayMs, config.throttle.maxDelayMs);
			}
		}

		// Save updated auth state for future runs
		await context.storageState({ path: authStatePath });
	} finally {
		await context?.close();
		await browser.close();
	}

	return result;
}

async function checkLoginStatus(page: Page): Promise<boolean> {
	try {
		// Look for login indicators or user profile elements
		const loginButton = await page.$('text=Login');
		const userMenu = await page.$('[data-testid="user-menu"], .user-menu, [class*="user"]');
		
		// If we see login button and no user menu, we're not logged in
		if (loginButton && !userMenu) {
			return false;
		}
		
		// If we see user menu or no login button, we're likely logged in
		return !loginButton || !!userMenu;
	} catch {
		return false;
	}
}

async function loginToBevy(page: Page, credentials: { email: string; password: string }) {
	try {
		console.log('Attempting to login...');
		// Click login button
		await page.click('text=Login');
		await page.waitForLoadState('networkidle');

		// Fill login form
		await page.fill('input[type="email"], input[name="email"]', credentials.email);
		await page.fill('input[type="password"], input[name="password"]', credentials.password);
		
		// Submit login
		await page.click('button[type="submit"], button:has-text("Login")');
		await page.waitForLoadState('networkidle');

		// Wait for redirect or success indicator
		await page.waitForTimeout(2000);
		console.log('Login completed');
	} catch (error) {
		throw new Error(`Login failed: ${error}`);
	}
}

async function addAttendee(page: Page, attendee: Attendee, isLastAttendee: boolean, attendeeIndex: number) {
	try {
		console.log(`\n=== Adding attendee ${attendeeIndex + 1}: ${attendee.firstName} ${attendee.lastName} ===`);
		
		// Click "Add attendee" button for every attendee (modal closes after each entry)
		await page.click('button:has-text("Add attendee")');
		console.log('Clicked Add attendee button');
		
		// Wait for modal to appear
		await page.waitForSelector('div[class*="modal"]', { timeout: 5000 });
		console.log('✓ Modal opened');
		await page.waitForTimeout(1000);
		
		// Clear form fields quickly
		await clearFormFields(page);

		// Fill fields quickly
		await page.fill('input[name="first_name"]', attendee.firstName);
		await page.fill('input[name="last_name"]', attendee.lastName);
		await page.fill('input[name="email"]', attendee.email);
		console.log(`✓ Filled: ${attendee.firstName} ${attendee.lastName} - ${attendee.email}`);

		// Skip check-in checkbox selection; user will handle it manually later
		if (attendee.checkedIn) {
			console.log('Skipping automated check-in checkbox selection (manual step).');
		}

		// Always click "Add" button (closes modal after each entry)
		await page.click('button[aria-label="Add"][type="button"]');
		console.log('✓ Clicked Add button');

		// Wait 1 second after Add button is clicked
		await page.waitForTimeout(1000);
		console.log('✓ Waited 1 second after Add button click');

		// Detect modal closing - wait for modal to disappear
		await page.waitForSelector('div[class*="modal"]', { state: 'hidden', timeout: 5000 });
		console.log('✓ Modal closed');

		// Wait a bit more to ensure the page is ready
		await page.waitForTimeout(500);

		console.log(`✓ Successfully processed attendee: ${attendee.firstName} ${attendee.lastName}`);

	} catch (error) {
		throw new Error(`Failed to add attendee: ${error}`);
	}
}

async function clearFormFields(page: Page) {
	// Clear fields quickly without logging
	await page.fill('input[name="first_name"]', '');
	await page.fill('input[name="last_name"]', '');
	await page.fill('input[name="email"]', '');
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(minMs: number, maxMs: number): Promise<void> {
	const delay = randomInt(minMs, maxMs);
	await new Promise(res => setTimeout(res, delay));
}
