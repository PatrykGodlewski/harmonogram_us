import {
	groups_member_items_save,
	groups_member_items_title,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { useEffect, useState } from "react";

type MemberItemsSheetProps = {
	member: { id: string; email: string; itemIds: string[] } | null;
	items: Array<{ id: string; title: string }>;
	saving: boolean;
	onClose: () => void;
	onSave: (memberId: string, itemIds: string[]) => void;
};

/** Per-student sessions, limited to the group's sessions. */
export function MemberItemsSheet({
	member,
	items,
	saving,
	onClose,
	onSave,
}: MemberItemsSheetProps) {
	const [selected, setSelected] = useState<string[]>([]);
	useEffect(() => setSelected(member?.itemIds ?? []), [member]);

	return (
		<Sheet open={member !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
				<SheetHeader>
					<SheetTitle>
						{groups_member_items_title({ email: member?.email ?? "" })}
					</SheetTitle>
				</SheetHeader>
				<div className="flex flex-col gap-2 px-4">
					{items.map((item) => (
						<label
							key={item.id}
							className="flex items-center gap-3 rounded-md border p-3"
						>
							<input
								type="checkbox"
								className="size-4"
								checked={selected.includes(item.id)}
								onChange={(event) =>
									setSelected((current) =>
										event.target.checked
											? [...current, item.id]
											: current.filter((id) => id !== item.id),
									)
								}
							/>
							{item.title}
						</label>
					))}
				</div>
				<SheetFooter>
					<Button
						disabled={saving || !member}
						onClick={() => member && onSave(member.id, selected)}
					>
						{groups_member_items_save()}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
