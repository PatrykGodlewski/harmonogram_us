import type { AuthenticatedUser } from "@repo/api/auth/user";
import { header_login, header_logout } from "@repo/i18n/paraglide/messages";
import { Link } from "@tanstack/react-router";
import { Button } from "../components/button";
import { LocaleSwitcher } from "./locale-switcher";
import { AdminLogo } from "./logo/admin-logo";

export interface AdminHeaderProps {
	user?: AuthenticatedUser | null;
}

export function AdminHeader({ user }: AdminHeaderProps) {
	return (
		<header className="border-b border-navy bg-navy text-manela">
			<nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
				<Link to="/" className="flex min-w-0 items-center gap-3">
					<AdminLogo
						badgeClassName="text-green"
						textClassName="sr-only sm:not-sr-only"
					/>
				</Link>

				<div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
					<LocaleSwitcher />
					{user ? (
						<Button asChild variant="outline" size="sm">
							<Link to="/logout">{header_logout()}</Link>
						</Button>
					) : (
						<Button asChild variant="ghost" size="sm" className="text-manela">
							<Link to="/login" search={{ redirect: undefined }}>
								{header_login()}
							</Link>
						</Button>
					)}
				</div>
			</nav>
		</header>
	);
}
