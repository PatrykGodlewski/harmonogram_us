import {
	admin_action_add,
	admin_action_delete,
	admin_action_edit,
	admin_table_empty,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import type { ReactNode } from "react";

export type AdminTableColumn<T> = {
	key: string;
	header: string;
	cell: (row: T) => ReactNode;
};

export interface AdminEntityTableProps<T> {
	title: string;
	description?: string;
	columns: AdminTableColumn<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	onAdd?: () => void;
	onEdit?: (row: T) => void;
	onDelete?: (row: T) => void;
	isLoading?: boolean;
}

export function AdminEntityTable<T>({
	title,
	description,
	columns,
	rows,
	rowKey,
	onAdd,
	onEdit,
	onDelete,
	isLoading = false,
}: AdminEntityTableProps<T>) {
	const showActions = Boolean(onEdit || onDelete);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					{description ? (
						<p className="mt-1 text-sm text-muted-foreground">{description}</p>
					) : null}
				</div>
				{onAdd ? (
					<Button type="button" onClick={onAdd}>
						{admin_action_add()}
					</Button>
				) : null}
			</div>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							{columns.map((column) => (
								<TableHead key={column.key}>{column.header}</TableHead>
							))}
							{showActions ? (
								<TableHead className="w-[140px] text-right">
									<span className="sr-only">Actions</span>
								</TableHead>
							) : null}
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell
									colSpan={columns.length + (showActions ? 1 : 0)}
									className="h-24 text-center text-muted-foreground"
								>
									...
								</TableCell>
							</TableRow>
						) : rows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={columns.length + (showActions ? 1 : 0)}
									className="h-24 text-center text-muted-foreground"
								>
									{admin_table_empty()}
								</TableCell>
							</TableRow>
						) : (
							rows.map((row) => (
								<TableRow key={rowKey(row)}>
									{columns.map((column) => (
										<TableCell key={column.key}>{column.cell(row)}</TableCell>
									))}
									{showActions ? (
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												{onEdit ? (
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => onEdit(row)}
													>
														{admin_action_edit()}
													</Button>
												) : null}
												{onDelete ? (
													<Button
														type="button"
														variant="destructive"
														size="sm"
														onClick={() => onDelete(row)}
													>
														{admin_action_delete()}
													</Button>
												) : null}
											</div>
										</TableCell>
									) : null}
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
