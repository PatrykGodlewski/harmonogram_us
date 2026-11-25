import type { AuthenticatedUser } from "@repo/api/auth/user";
import {
	account_title,
	header_login,
	header_logout,
	header_my_events,
	header_signup,
} from "@repo/i18n/paraglide/messages";
import { Link } from "@tanstack/react-router";
import { LogOutIcon, UserIcon } from "lucide-react";
import { Button } from "../components/button";
import { LocaleSwitcher } from "./locale-switcher";
import { ClientLogo } from "./logo/client-logo";

export interface HeaderProps {
	user?: AuthenticatedUser | null;
}

export function Header({ user }: HeaderProps) {
	return (
		<header className="border-b border-navy bg-navy text-manela print:hidden">
			<nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
				<Link to="/" className="flex min-w-0 items-center gap-3">
					<ClientLogo
						badgeClassName="text-green"
						textClassName="sr-only sm:not-sr-only"
					/>
				</Link>

				<div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 sm:gap-3">
					<LocaleSwitcher />
					{user ? (
						<>
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="px-2 text-xs text-manela sm:px-3 sm:text-sm"
							>
								<Link to="/my-events">{header_my_events()}</Link>
							</Button>
							<Button asChild variant="outline" size="sm" className="w-9 px-0">
								<Link to="/account" aria-label={account_title()}>
									<UserIcon aria-hidden className="size-4" />
								</Link>
							</Button>
							<Button asChild variant="outline" size="sm" className="w-9 px-0">
								<Link to="/logout" aria-label={header_logout()}>
									<LogOutIcon aria-hidden className="size-4" />
								</Link>
							</Button>
						</>
					) : (
						<>
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="px-2 text-xs text-manela sm:px-3 sm:text-sm"
							>
								<Link to="/login" search={{ redirect: undefined }}>
									{header_login()}
								</Link>
							</Button>
							<Button
								asChild
								size="sm"
								className="px-2 text-xs sm:px-3 sm:text-sm"
							>
								<Link to="/signup">{header_signup()}</Link>
							</Button>
						</>
					)}
				</div>
			</nav>
		</header>
	);
}
