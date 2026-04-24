import type { AuthenticatedUser } from "@repo/api/auth/user";
import {
	header_login,
	header_logout,
	header_signup,
} from "@repo/i18n/paraglide/messages";
import { Link } from "@tanstack/react-router";
import { LocaleSwitcher } from "./locale-switcher";

export interface HeaderProps {
	user?: AuthenticatedUser | null;
}

export function Header({ user }: HeaderProps) {
	return (
		<nav className="flex items-center justify-between border-b px-6 py-4">
			<Link to="/" className="font-semibold">
				<img
					src="https://placehold.co/120x32?text=Logo"
					alt="Brand logo"
					className="h-8 w-auto"
				/>
			</Link>
			<div className="flex flex-wrap items-center justify-end gap-4">
				<LocaleSwitcher />
				{user ? (
					<>
						<span className="text-muted-foreground">{user.email}</span>
						<Link to="/logout" className="text-primary hover:underline">
							{header_logout()}
						</Link>
					</>
				) : (
					<>
						<Link
							to="/login"
							search={{ redirect: undefined }}
							className="text-primary hover:underline"
						>
							{header_login()}
						</Link>
						<Link to="/signup" className="text-primary hover:underline">
							{header_signup()}
						</Link>
					</>
				)}
			</div>
		</nav>
	);
}
