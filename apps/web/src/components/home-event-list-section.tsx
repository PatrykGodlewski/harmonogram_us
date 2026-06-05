import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/client-only";
import {
	HomeEventList,
	type HomeEventListProps,
} from "~/components/home-event-list";

const HomeEventListLive = lazy(
	() => import("~/components/home-event-list-live"),
);

export function HomeEventListSection(props: HomeEventListProps) {
	return (
		<ClientOnly fallback={<HomeEventList {...props} />}>
			<Suspense fallback={<HomeEventList {...props} />}>
				<HomeEventListLive {...props} />
			</Suspense>
		</ClientOnly>
	);
}
