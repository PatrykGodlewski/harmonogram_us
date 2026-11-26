import { describe, expect, it, vi } from "vitest";
import { handleEventImageJob } from "../src/handlers/event-image";

describe("handleEventImageJob", () => {
	it("runs the pipeline with the parsed job", async () => {
		const generate = vi.fn(async () => "ready" as const);
		expect(await handleEventImageJob({ eventId: "e1", force: true }, generate)).toBe("ready");
		expect(generate).toHaveBeenCalledWith({ eventId: "e1", force: true });
	});

	it("logs instead of throwing on a bad payload or an unexpected error", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const generate = vi.fn(async () => {
			throw new Error("database down");
		});
		expect(await handleEventImageJob({ eventId: "e1" }, generate)).toBe("error");
		expect(generate).not.toHaveBeenCalled();
		expect(await handleEventImageJob({ eventId: "e1", force: false }, generate)).toBe("error");
		expect(error).toHaveBeenCalledTimes(2);
		error.mockRestore();
	});
});
