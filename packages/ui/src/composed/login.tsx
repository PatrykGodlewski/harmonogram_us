import { Auth } from './auth';

export interface LoginProps {
	onLogin: (data: { email: string; password: string }) => void;
	error?: { message?: string } | null;
	success?: boolean;
	isLoading?: boolean;
}

export function Login({ onLogin, error, success, isLoading }: LoginProps) {
	return (
		<Auth
			title="Log in"
			submitLabel="Log in"
			isLoading={isLoading}
			loadingLabel="Logging in..."
			onSubmit={(e) => {
				e.preventDefault();
				const form = e.target as HTMLFormElement;
				const formData = new FormData(form);
				onLogin({
					email: formData.get('email') as string,
					password: formData.get('password') as string,
				});
			}}
			afterSubmit={
				error ? (
					<span role="alert">{error.message}</span>
				) : success ? (
					<span className="text-green-600 dark:text-green-400" role="status">
						Logged in! Redirecting...
					</span>
				) : null
			}
		>
			<div>
				<label htmlFor="email" className="block text-sm font-medium">
					Email
				</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					disabled={isLoading}
					className="mt-1 w-full rounded-md border px-3 py-2"
				/>
			</div>
			<div>
				<label htmlFor="password" className="block text-sm font-medium">
					Password
				</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					disabled={isLoading}
					className="mt-1 w-full rounded-md border px-3 py-2"
				/>
			</div>
		</Auth>
	);
}
