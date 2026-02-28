import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseCsvFile } from './inputs.js';
import { runImporter } from './runner.js';
import { ensureAuthDir, config } from './config.js';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
	fs.mkdirSync('uploads');
}

app.get('/', (req, res) => {
	res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bevy Attendee Importer</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: 600; }
        input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        button:disabled { background: #6c757d; cursor: not-allowed; }
        .progress { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 4px; display: none; }
        .error { color: #dc3545; margin-top: 10px; }
        .success { color: #28a745; margin-top: 10px; }
        .help-text { font-size: 12px; color: #6c757d; margin-top: 5px; }
        .section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section h3 { margin-top: 0; color: #495057; }
        .credentials-info { background: #e7f3ff; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 14px; color: #0066cc; }
    </style>
</head>
<body>
    <h1>Bevy Attendee Importer</h1>
    <p>Import attendees from CSV into Bevy events</p>
    
    <form id="importForm" enctype="multipart/form-data">
        <div class="section">
            <h3>Bevy Event Details</h3>
            <div class="credentials-info">
                ✓ Login credentials are pre-configured and will be used automatically
            </div>
            <div class="form-group">
                <label for="eventUrl">Event URL *</label>
                <input type="url" id="eventUrl" name="eventUrl" required 
                       placeholder="https://friends.figma.com/dashboard/mumbai/events/4199/registrations">
                <div class="help-text">Full URL to the Bevy event registrations page</div>
            </div>
        </div>

        <div class="section">
            <h3>Attendee Data</h3>
            <div class="form-group">
                <label for="csvFile">CSV File *</label>
                <input type="file" id="csvFile" name="csvFile" accept=".csv" required />
                <div class="help-text">CSV with columns: First Name, Last Name, Email, Checked In (Yes/No)</div>
            </div>
        </div>

        <button type="submit" id="submitBtn">Start Import</button>
    </form>

    <div id="progress" class="progress">
        <div id="progressText">Preparing import...</div>
        <div id="progressDetails"></div>
    </div>

    <div id="result"></div>

    <script>
        document.getElementById('importForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const progress = document.getElementById('progress');
            const result = document.getElementById('result');
            const progressText = document.getElementById('progressText');
            const progressDetails = document.getElementById('progressDetails');
            
            submitBtn.disabled = true;
            progress.style.display = 'block';
            result.innerHTML = '';
            
            const formData = new FormData(e.target);
            
            try {
                progressText.textContent = 'Starting import...';
                progressDetails.textContent = 'Connecting to Bevy...';
                
                const response = await fetch('/import', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    result.innerHTML = \`
                        <div class="success">
                            <h3>Import Complete!</h3>
                            <p>Successfully imported: \${data.result.stats.success} attendees</p>
                            <p>Failed: \${data.result.stats.failed} attendees</p>
                            \${data.result.stats.retried > 0 ? \`<p>Retried: \${data.result.stats.retried} attendees</p>\` : ''}
                            \${data.result.errors.length > 0 ? \`<p><a href="/download-failures" target="_blank">Download failure details</a></p>\` : ''}
                        </div>
                    \`;
                } else {
                    result.innerHTML = \`<div class="error">Error: \${data.error}</div>\`;
                }
            } catch (error) {
                result.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
            } finally {
                submitBtn.disabled = false;
                progress.style.display = 'none';
            }
        });
    </script>
</body>
</html>
	`);
});

app.post('/import', upload.single('csvFile'), async (req, res) => {
	try {
		const { eventUrl } = req.body;
		
		if (!eventUrl) {
			return res.json({ success: false, error: 'Event URL is required' });
		}

		if (!req.file) {
			return res.json({ success: false, error: 'CSV file is required' });
		}

		const attendees = await parseCsvFile(req.file.path);

		if (attendees.length === 0) {
			return res.json({ success: false, error: 'No attendees found in CSV file' });
		}

		// Clean up uploaded file
		fs.unlinkSync(req.file.path);

		ensureAuthDir();
		const result = await runImporter({
			attendees,
			eventUrl,
			headless: false, // Always show browser
			slowMoMs: 0,
			authStatePath: '.auth/bevy-auth.json',
			credentials: { email: config.bevy.email, password: config.bevy.password }
		});

		// Store failures for download
		if (result.errors.length > 0) {
			fs.writeFileSync('import-failures.json', JSON.stringify(result.errors, null, 2));
		}

		res.json({ success: true, result });
	} catch (error: any) {
		res.json({ success: false, error: error.message });
	}
});

app.get('/download-failures', (req, res) => {
	if (fs.existsSync('import-failures.json')) {
		res.download('import-failures.json');
	} else {
		res.status(404).send('No failure data found');
	}
});

export function startWebUI(port = 3000) {
	app.listen(port, () => {
		console.log(`Web UI running at http://localhost:${port}`);
		console.log('Open your browser and navigate to the URL above to use the importer');
	});
}
