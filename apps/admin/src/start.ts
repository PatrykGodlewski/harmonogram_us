import { errorStatusMiddleware } from "@repo/api/error-status-middleware";
import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
	functionMiddleware: [errorStatusMiddleware],
}));
