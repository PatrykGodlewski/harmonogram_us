import type { UniversitySignIn } from "@repo/api/auth/university";
import type { GuestForm } from "@repo/api/events/guest-form";
import {
	registration_choice,
	registration_choice_account,
	registration_choice_account_hint,
	registration_choice_guest,
	registration_choice_guest_hint,
	registration_create_account,
	registration_for,
	registration_no_account,
} from "@repo/i18n/paraglide/messages";
import { Login } from "@repo/ui/composed/login";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { GuestRegistrationForm } from "./guest-registration-form";

type EventRegistrationChoiceProps = {
	form: GuestForm;
	invite?: string;
	redirectTo: string;
	/** The same-site path to come back to (for the sign-up link). */
	redirectPath: string;
	university: UniversitySignIn;
	failed: boolean;
};

type Choice = "account" | "guest";

/**
 * The one place a signed-out visitor registers for an event: with an account (the
 * default: sign in or sign up, then register with one click) or with an e-mail link.
 */
export function EventRegistrationChoice({
	form,
	invite,
	redirectTo,
	redirectPath,
	university,
	failed,
}: EventRegistrationChoiceProps) {
	const [choice, setChoice] = useState<Choice>("account");
	const legendId = useId();
	const options: { value: Choice; label: string; hint: string }[] = [
		{
			value: "account",
			label: registration_choice_account(),
			hint: registration_choice_account_hint(),
		},
		{
			value: "guest",
			label: registration_choice_guest(),
			hint: registration_choice_guest_hint(),
		},
	];

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border p-6">
			<h1 className="text-xl font-semibold break-words">
				{registration_for({ title: form.title })}
			</h1>
			<div
				role="radiogroup"
				aria-labelledby={legendId}
				className="flex flex-col gap-2"
			>
				<p id={legendId} className="text-sm font-medium">
					{registration_choice()}
				</p>
				{options.map((option) => (
					<label
						key={option.value}
						className="flex cursor-pointer gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
					>
						<input
							type="radio"
							name="registration-choice"
							value={option.value}
							checked={choice === option.value}
							onChange={() => setChoice(option.value)}
							className="mt-1 accent-primary"
						/>
						<span className="flex flex-col">
							<span className="font-medium">{option.label}</span>
							<span className="text-sm text-muted-foreground">
								{option.hint}
							</span>
						</span>
					</label>
				))}
			</div>
			{choice === "account" ? (
				<div className="flex flex-col gap-3">
					<Login
						embedded
						redirectTo={redirectTo}
						university={university}
						failed={failed}
					/>
					<p className="text-sm text-muted-foreground">
						{registration_no_account()}{" "}
						<Link
							to="/signup"
							search={{ redirect: redirectPath }}
							className="font-medium text-foreground underline underline-offset-2"
						>
							{registration_create_account()}
						</Link>
					</p>
				</div>
			) : (
				<GuestRegistrationForm form={form} invite={invite} />
			)}
		</div>
	);
}
