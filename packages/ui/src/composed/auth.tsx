import type { ReactNode } from 'react';
import { Button } from '../components/button';

export interface AuthProps {
	onSubmit: React.ComponentProps<'form'>['onSubmit'];
	afterSubmit?: ReactNode;
	title: string;
	submitLabel: string;
	isLoading?: boolean;
	loadingLabel?: string;
	children: ReactNode;
}

export function Auth({
	onSubmit,
	afterSubmit,
	title,
	submitLabel,
	isLoading = false,
	loadingLabel,
	children,
}: AuthProps) {
	return (
		<div className="mx-auto max-w-sm rounded-lg border p-6">
			<h2 className="mb-4 text-xl font-semibold">{title}</h2>
			<form onSubmit={onSubmit} className="space-y-4">
				{children}
				<Button type="submit" disabled={isLoading}>
					{isLoading ? (loadingLabel ?? 'Loading...') : submitLabel}
				</Button>
			</form>
			{afterSubmit ? <div className="mt-4 text-sm text-destructive">{afterSubmit}</div> : null}
		</div>
	);
}
