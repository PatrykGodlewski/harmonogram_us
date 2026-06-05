import {
	admin_nav_dashboard,
	admin_nav_event_faculties,
	admin_nav_event_locations,
	admin_nav_event_types,
	admin_nav_events,
	admin_nav_section,
	header_logout,
} from "@repo/i18n/paraglide/messages";
import { Link, useRouterState } from "@tanstack/react-router";
import {
	CalendarDaysIcon,
	GraduationCapIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	MapPinIcon,
	TagIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { AdminLogo } from "../logo/admin-logo";

const navItems = [
	{
		to: "/",
		label: admin_nav_dashboard,
		icon: LayoutDashboardIcon,
	},
	{
		to: "/events",
		label: admin_nav_events,
		icon: CalendarDaysIcon,
	},
	{
		to: "/event-types",
		label: admin_nav_event_types,
		icon: TagIcon,
	},
	{
		to: "/event-locations",
		label: admin_nav_event_locations,
		icon: MapPinIcon,
	},
	{
		to: "/event-faculties",
		label: admin_nav_event_faculties,
		icon: GraduationCapIcon,
	},
] as const;

export interface AdminLayoutProps {
	children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<SidebarProvider className="min-h-svh">
			<Sidebar collapsible="icon">
				<SidebarHeader className="flex h-16 shrink-0 flex-row items-center border-b px-4 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
					<AdminLogo
						size="sm"
						className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
						textClassName="group-data-[collapsible=icon]:hidden"
					/>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>{admin_nav_section()}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{navItems.map((item) => {
									const Icon = item.icon;
									const isActive =
										item.to === "/"
											? pathname === "/"
											: pathname.startsWith(item.to);

									return (
										<SidebarMenuItem key={item.to}>
											<SidebarMenuButton
												asChild
												isActive={isActive}
												tooltip={item.label()}
											>
												<Link to={item.to}>
													<Icon />
													<span>{item.label()}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter className="border-t p-2">
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild tooltip={header_logout()}>
								<Link to="/logout">
									<LogOutIcon />
									<span>{header_logout()}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>
			<SidebarInset className="flex flex-col">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
				</header>
				<div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
