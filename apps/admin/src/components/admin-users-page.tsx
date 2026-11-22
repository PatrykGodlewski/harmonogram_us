import {
	searchUsersQueryOptions,
	setUserRoleServer,
	type UserListItem,
} from "@repo/api/admin/users";
import {
	admin_error_generic,
	admin_role_admin,
	admin_role_organizer,
	admin_role_user,
	admin_users_description,
	admin_users_empty,
	admin_users_role,
	admin_users_role_saved,
	admin_users_search,
	admin_users_title,
	admin_users_you,
} from "@repo/i18n/paraglide/messages";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { PageHeader } from "@repo/ui/composed/page-header";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

type Role = UserListItem["role"];

const ROLE_LABELS: Record<Role, () => string> = {
	user: admin_role_user,
	organizer: admin_role_organizer,
	admin: admin_role_admin,
};

/** Waits this long after typing before searching. */
const SEARCH_DELAY_MS = 300;

type AdminUsersPageProps = {
	query: string;
	onQueryChange: (query: string) => void;
	currentUserId: string;
};

export function AdminUsersPage({
	query,
	onQueryChange,
	currentUserId,
}: AdminUsersPageProps) {
	const searchId = useId();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState(query);
	const { data: users = [], isFetched } = useQuery(
		searchUsersQueryOptions(query),
	);

	useEffect(() => {
		if (draft === query) {
			return;
		}
		const timer = setTimeout(() => onQueryChange(draft), SEARCH_DELAY_MS);
		return () => clearTimeout(timer);
	}, [draft, query, onQueryChange]);

	const roleMutation = useMutation({
		mutationFn: (input: { userId: string; role: Role }) =>
			setUserRoleServer({ data: input }),
		onSuccess: async () => {
			toast.success(admin_users_role_saved());
			await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title={admin_users_title()}
				description={admin_users_description()}
			/>
			<div className="flex max-w-md flex-col gap-2">
				<Label htmlFor={searchId}>{admin_users_search()}</Label>
				<Input
					id={searchId}
					type="search"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
				/>
			</div>
			{isFetched && users.length === 0 ? (
				<p className="text-sm text-muted-foreground">{admin_users_empty()}</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{users.map((user) => (
						<UserRow
							key={user.id}
							user={user}
							isSelf={user.id === currentUserId}
							disabled={roleMutation.isPending}
							onRoleChange={(role) =>
								roleMutation.mutate({ userId: user.id, role })
							}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

type UserRowProps = {
	user: UserListItem;
	isSelf: boolean;
	disabled: boolean;
	onRoleChange: (role: Role) => void;
};

function UserRow({ user, isSelf, disabled, onRoleChange }: UserRowProps) {
	const selectId = useId();
	return (
		<li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<p className="font-medium break-all">
					{user.email} {isSelf ? admin_users_you() : null}
				</p>
				<p className="text-sm text-muted-foreground">{user.name}</p>
			</div>
			<div className="flex items-center gap-2">
				<Label htmlFor={selectId} className="sr-only">
					{admin_users_role()}
				</Label>
				<Select
					value={user.role}
					onValueChange={(value) => onRoleChange(value as Role)}
					disabled={disabled || isSelf}
				>
					<SelectTrigger
						id={selectId}
						aria-label={admin_users_role()}
						className="w-full sm:w-44"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
							<SelectItem key={role} value={role}>
								{ROLE_LABELS[role]()}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</li>
	);
}
