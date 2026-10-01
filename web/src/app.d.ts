declare global {
	namespace App {
		interface Platform {
			context?: { waitUntil(promise: Promise<unknown>): void };
			env?: { HYPERDRIVE?: { connectionString: string } };
		}
		interface Locals {
			user: { userId: string; email: string } | null;
		}
	}
}

export {};
