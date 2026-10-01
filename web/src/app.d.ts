declare global {
	namespace App {
		interface Locals {
			user: { userId: string; email: string } | null;
		}
	}
}

export {};
