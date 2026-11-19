import { describe, expect, it } from "vitest";
import { handleEmailJob } from "../src/handlers/send-email";

type Sent = { to: string; subject: string; text: string; html?: string };

function capture() {
	const sent: Sent[] = [];
	return {
		sent,
		deps: {
			send: async (message: Sent) => {
				sent.push(message);
			},
		},
	};
}

describe("handleEmailJob", () => {
	it("verification job sends the link", async () => {
		const { sent, deps } = capture();
		await handleEmailJob(
			{
				kind: "verification",
				to: "new@x.test",
				url: "https://events.example.test/api/auth/verify-email?token=abc",
				locale: "pl",
			},
			deps,
		);
		expect(sent).toHaveLength(1);
		expect(sent[0]?.to).toBe("new@x.test");
		expect(sent[0]?.text).toContain("https://events.example.test/api/auth/verify-email?token=abc");
	});
});
