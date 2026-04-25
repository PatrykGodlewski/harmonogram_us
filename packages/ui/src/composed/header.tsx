import type { AuthenticatedUser } from "@repo/api/auth/user";
import {
	header_login,
	header_logout,
	header_signup,
} from "@repo/i18n/paraglide/messages";
import { Link } from "@tanstack/react-router";
import { Button } from "../components/button";
import { LocaleSwitcher } from "./locale-switcher";

export interface HeaderProps {
	user?: AuthenticatedUser | null;
}

export function Header({ user }: HeaderProps) {
	return (
		<header className="border-b bg-background">
			<nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
				<Link to="/" className="flex items-center gap-3">
					<span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
						H
					</span>
					<div className="leading-tight">
						<p className="text-sm font-semibold tracking-wide text-foreground">
							Harmonogram
						</p>
						<p className="text-xs text-muted-foreground">University Services</p>
					</div>
				</Link>

				<div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
					<LocaleSwitcher />
					{user ? (
						<>
							<Button asChild variant="outline" size="sm" className="w-9 px-0">
								<Link to="/account" aria-label="Account">
									<svg
										aria-hidden="true"
										viewBox="0 0 24 24"
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<circle cx="12" cy="8" r="4" />
										<path d="M4 20a8 8 0 0 1 16 0" />
									</svg>
								</Link>
							</Button>
							<Button asChild variant="outline" size="sm">
								<Link to="/logout">{header_logout()}</Link>
							</Button>
						</>
					) : (
						<>
							<Button asChild variant="ghost" size="sm">
								<Link to="/login" search={{ redirect: undefined }}>
									{header_login()}
								</Link>
							</Button>
							<Button asChild size="sm">
								<Link to="/signup">{header_signup()}</Link>
							</Button>
						</>
					)}
				</div>
			</nav>
		</header>
	);
}
