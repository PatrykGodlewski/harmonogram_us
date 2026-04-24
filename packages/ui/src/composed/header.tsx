export interface HeaderProps {
	user?: {
		email: string;
	} | null;
}

export function Header({ user }: HeaderProps) {
	return (
		<nav className="flex items-center justify-between border-b px-6 py-4">
			<a href="/" className="font-semibold">
				University Events
			</a>
			<div className="flex gap-4">
				{user ? (
					<>
						<span className="text-muted-foreground">{user.email}</span>
						<a href="/logout" className="text-primary hover:underline">
							Logout
						</a>
					</>
				) : (
					<>
						<a href="/login" className="text-primary hover:underline">
							Login
						</a>
						<a href="/signup" className="text-primary hover:underline">
							Sign up
						</a>
					</>
				)}
			</div>
		</nav>
	);
}
