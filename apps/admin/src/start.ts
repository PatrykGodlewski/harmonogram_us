import { errorStatusMiddleware } from "@repo/api/error-status-middleware";
import { requestMetricsMiddleware } from "@repo/api/observability/request-metrics-middleware";
import { requestSizeMiddleware } from "@repo/api/request-size-middleware";
import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
	requestMiddleware: [requestMetricsMiddleware, requestSizeMiddleware],
	functionMiddleware: [errorStatusMiddleware],
}));
