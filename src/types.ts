export type Attendee = {
	firstName: string;
	lastName: string;
	email: string;
	checkedIn: boolean;
	rowIndex?: number;
};

export type ImportStats = {
	total: number;
	success: number;
	failed: number;
	retried: number;
};

export type ImportResult = {
	stats: ImportStats;
	successes: Attendee[];
	errors: { attendee: Attendee; error: string }[];
}; 