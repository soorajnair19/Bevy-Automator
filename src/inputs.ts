import fs from 'fs';
import { parse } from 'csv-parse';
import fetch from 'node-fetch';
import { Attendee } from './types.js';

function normalizeBoolean(value: string | undefined): boolean {
	if (!value) return false;
	const v = value.trim().toLowerCase();
	return v === 'yes' || v === 'true' || v === '1' || v === 'y';
}

function mapRecordToAttendee(record: Record<string, string>, rowIndex: number): Attendee {
	// More flexible column name matching
	const firstName = record['First Name']?.trim() || 
		record['first_name']?.trim() || 
		record['FirstName']?.trim() || 
		record['firstname']?.trim() ||
		record['First']?.trim() ||
		record['first']?.trim() ||
		'';
		
	const lastName = record['Last Name']?.trim() || 
		record['last_name']?.trim() || 
		record['LastName']?.trim() || 
		record['lastname']?.trim() ||
		record['Last']?.trim() ||
		record['last']?.trim() ||
		'';
		
	const email = record['Email']?.trim() || 
		record['email']?.trim() || 
		record['Email Address']?.trim() ||
		record['email_address']?.trim() ||
		'';
		
	const checkedInValue = record['Checked In'] || 
		record['checked_in'] || 
		record['CheckedIn'] ||
		record['checkedin'] ||
		record['Check-in'] ||
		record['check-in'] ||
		record['Attended'] ||
		record['attended'];
		
	const checkedIn = normalizeBoolean(checkedInValue);
	
	// Debug logging
	console.log(`  Row ${rowIndex}: ${firstName} ${lastName} (${email}) - Raw Checked In: "${checkedInValue}" -> Parsed: ${checkedIn}`);
	
	return { firstName, lastName, email, checkedIn, rowIndex };
}

export async function parseCsvFile(filePath: string): Promise<Attendee[]> {
	const content = fs.readFileSync(filePath, 'utf8');
	return new Promise((resolve, reject) => {
		const attendees: Attendee[] = [];
		parse(content, { columns: true, skip_empty_lines: true, trim: true })
			.on('readable', function (this: any) {
				let record;
				let row = 2; // considering header at row 1
				while ((record = this.read()) !== null) {
					attendees.push(mapRecordToAttendee(record, row++));
				}
			})
			.on('error', reject)
			.on('end', () => resolve(attendees));
	});
}

function toCsvExportUrl(sheetUrl: string): string {
	// Support typical Google Sheets URL -> CSV export of first sheet
	// https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>
	const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	if (!match) return sheetUrl;
	const id = match[1];
	const gidMatch = sheetUrl.match(/[#&?]gid=(\d+)/);
	const gid = gidMatch ? gidMatch[1] : '0';
	return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export async function parseGoogleSheet(sheetUrl: string): Promise<Attendee[]> {
	const exportUrl = toCsvExportUrl(sheetUrl);
	const res = await fetch(exportUrl);
	if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status} ${res.statusText}`);
	const csv = await res.text();
	return new Promise((resolve, reject) => {
		const attendees: Attendee[] = [];
		parse(csv, { columns: true, skip_empty_lines: true, trim: true })
			.on('readable', function (this: any) {
				let record;
				let row = 2;
				while ((record = this.read()) !== null) {
					attendees.push(mapRecordToAttendee(record, row++));
				}
			})
			.on('error', reject)
			.on('end', () => resolve(attendees));
	});
}
