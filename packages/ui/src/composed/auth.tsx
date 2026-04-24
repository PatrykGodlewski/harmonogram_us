import * as React from 'react';
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '../components/alert';
import { Button } from '../components/button';
import { Input } from '../components/input';
import { Label } from '../components/label';

type AuthContextValue = {
	isLoading: boolean;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuthForm() {
	const context = React.useContext(AuthContext);
	if (!context) {
		throw new Error('useAuthForm must be used within Auth.Root');
	}
	return context;
}

type AuthErrorLike = { message?: string } | null | undefined;

interface UseAuthStatusInput {
	clientError?: string | null;
	isRequestError: boolean;
	requestErrorMessage?: string;
	serverError?: AuthErrorLike;
}

export function useAuthStatus({
	clientError,
	isRequestError,
	requestErrorMessage,
	serverError,
}: UseAuthStatusInput): { error: { message?: string } | null } {
	return React.useMemo(() => {
		if (clientError) return { error: { message: clientError } };
		if (isRequestError) {
			return {
				error: {
					message: requestErrorMessage ?? 'Something went wrong',
				},
			};
		}
		if (serverError) return { error: serverError };
		return { error: null };
	}, [clientError, isRequestError, requestErrorMessage, serverError]);
}

export interface AuthRootProps {
	onSubmit: React.ComponentProps<'form'>['onSubmit'];
	title: string;
	isLoading?: boolean;
	children: React.ReactNode;
}

function Root({
	onSubmit,
	title,
	isLoading = false,
	children,
}: AuthRootProps) {
	return (
		<AuthContext.Provider value={{ isLoading }}>
			<div className="mx-auto max-w-sm rounded-lg border p-6">
				<h2 className="mb-4 text-xl font-semibold">{title}</h2>
				<form onSubmit={onSubmit} className="space-y-4">
					{children}
				</form>
			</div>
		</AuthContext.Provider>
	);
}

interface AuthFieldProps extends Omit<React.ComponentProps<typeof Input>, 'id' | 'name' | 'type'> {
	name: string;
	label: string;
	type?: React.ComponentProps<typeof Input>['type'];
}

function Field({ name, label, type = 'text', ...props }: AuthFieldProps) {
	const { isLoading } = useAuthForm();
	return (
		<div>
			<Label htmlFor={name}>{label}</Label>
			<Input id={name} name={name} type={type} className="mt-1" disabled={isLoading} {...props} />
		</div>
	);
}

interface AuthSubmitProps extends Omit<React.ComponentProps<typeof Button>, 'type'> {
	label: string;
	loadingLabel?: string;
}

function Submit({ label, loadingLabel, children, ...props }: AuthSubmitProps) {
	const { isLoading } = useAuthForm();
	return (
		<Button type="submit" disabled={isLoading} className="w-full" {...props}>
			{isLoading ? (loadingLabel ?? 'Loading...') : (children ?? label)}
		</Button>
	);
}

function Feedback({ children }: { children?: React.ReactNode }) {
	if (!children) return null;
	return <div className="text-sm">{children}</div>;
}

interface AuthStatusProps {
	error?: { message?: string } | null;
	success?: boolean;
	successMessage: string;
	errorTitle?: string;
	successTitle?: string;
}

function Status({
	error,
	success,
	successMessage,
	errorTitle = 'Something went wrong',
	successTitle = 'Success',
}: AuthStatusProps) {
	if (error) {
		return (
			<Alert variant="destructive">
				<AlertTitle>{errorTitle}</AlertTitle>
				<AlertDescription>{error.message ?? 'Please try again.'}</AlertDescription>
			</Alert>
		);
	}
	if (!success) return null;
	return (
		<Alert variant="success">
			<AlertTitle>{successTitle}</AlertTitle>
			<AlertDescription>{successMessage}</AlertDescription>
		</Alert>
	);
}

export const Auth = {
	Root,
	Field,
	Submit,
	Feedback,
	Status,
};
