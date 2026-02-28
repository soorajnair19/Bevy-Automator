import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parseCsvFile, parseGoogleSheet } from './inputs.js';
import { runImporter } from './runner.js';
import { startWebUI } from './web-ui.js';
import { ensureAuthDir } from './config.js';
import fs from 'fs';

async function main() {
	const argv = await yargs(hideBin(process.argv))
		.option('web', {
			alias: 'w',
			describe: 'Start web UI',
			type: 'boolean',
			default: false
		})
		.option('port', {
			alias: 'p',
			describe: 'Port for web UI',
			type: 'number',
			default: 3000
		})
		.option('csv', {
			alias: 'c',
			describe: 'CSV file path',
			type: 'string'
		})
		.option('event', {
			alias: 'e',
			describe: 'Bevy event URL',
			type: 'string'
		})
		.option('email', {
			describe: 'Bevy email',
			type: 'string'
		})
		.option('password', {
			describe: 'Bevy password',
			type: 'string'
		})
		.option('slow', {
			alias: 's',
			describe: 'Slow motion delay in ms',
			type: 'number',
			default: 0
		})
		.option('auth', {
			alias: 'a',
			describe: 'Auth state file path',
			type: 'string',
			default: '.auth/bevy-auth.json'
		})
		.help()
		.argv;

	if (argv.web) {
		startWebUI(argv.port);
		return;
	}

	// CLI mode
	if (!argv.event) {
		console.error('Error: Event URL is required. Use --event or -e');
		process.exit(1);
	}

	if (!argv.csv) {
		console.error('Error: CSV file is required. Use --csv or -c');
		process.exit(1);
	}

	try {
		ensureAuthDir();
		
		console.log('📁 Parsing CSV file...');
		const attendees = await parseCsvFile(argv.csv);
		console.log(`📊 Found ${attendees.length} attendees`);

		// Display detailed CSV data for verification
		console.log('\n📋 CSV Data Verification:');
		attendees.forEach((attendee, index) => {
			console.log(`  ${index + 1}. ${attendee.firstName} ${attendee.lastName} (${attendee.email}) - Checked In: ${attendee.checkedIn ? 'YES' : 'NO'}`);
		});
		console.log('');

		console.log('🚀 Starting import...');
		const result = await runImporter({
			attendees,
			eventUrl: argv.event,
			headless: false,
			slowMoMs: argv.slow,
			authStatePath: argv.auth,
			credentials: argv.email && argv.password ? { email: argv.email, password: argv.password } : undefined
		});

		console.log('\n📈 Import Results:');
		console.log(`✅ Success: ${result.stats.success}`);
		console.log(`❌ Failed: ${result.stats.failed}`);
		console.log(`🔄 Retried: ${result.stats.retried}`);

		if (result.errors.length > 0) {
			console.log('\n❌ Errors:');
			result.errors.forEach((error: any, index: number) => {
				console.log(`${index + 1}. ${error.attendee.firstName} ${error.attendee.lastName}: ${error.error}`);
			});
			
			// Save failures to file
			fs.writeFileSync('import-failures.json', JSON.stringify(result.errors, null, 2));
			console.log('\n💾 Failure details saved to import-failures.json');
		}
	} catch (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	}
}

main();
