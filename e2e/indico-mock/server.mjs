// A stand-in for the university's Indico in the e2e stack: the HTTP export API
// (/export/categ/{ids}.json) with events relative to today, behind a bearer token.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 18081);
const TOKEN = process.env.TOKEN ?? "";
const DAY = 86_400_000;

/** Wall-clock date and time in Warsaw, as Indico writes them. */
function indicoDate(daysFromNow, time) {
	const date = new Date(Date.now() + daysFromNow * DAY).toLocaleDateString("sv-SE", {
		timeZone: "Europe/Warsaw",
	});
	return { date, time, tz: "Europe/Warsaw" };
}

function events() {
	return [
		{
			_type: "Conference",
			id: "1001",
			title: "Seminarium z Indico",
			description: "<p>Opis w Indico</p>",
			startDate: indicoDate(3, "10:00:00"),
			endDate: indicoDate(3, "12:00:00"),
			location: "Aula Główna",
			room: "A1",
			// Ignored by the import: links are built from the configured address.
			url: "javascript:alert(1)",
			timezone: "Europe/Warsaw",
			type: "lecture",
			category: "Seminaria",
			keywords: [],
		},
		{
			_type: "Conference",
			id: "1002",
			title: "Konferencja z Indico",
			description: "",
			startDate: indicoDate(10, "09:00:00"),
			endDate: indicoDate(11, "17:00:00"),
			location: "",
			room: null,
			url: "http://indico.localhost/event/1002/",
			timezone: "Europe/Warsaw",
			type: "conference",
			category: "Konferencje",
			keywords: [],
		},
	];
}

createServer((request, response) => {
	const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
	if (!/^\/export\/categ\/[\d-]+\.json$/.test(url.pathname)) {
		response.writeHead(404).end();
		return;
	}
	if (TOKEN && request.headers.authorization !== `Bearer ${TOKEN}`) {
		response.writeHead(401, { "content-type": "application/json" });
		response.end(JSON.stringify({ error: "invalid token" }));
		return;
	}
	const results = events();
	response.writeHead(200, { "content-type": "application/json" });
	response.end(
		JSON.stringify({ _type: "HTTPAPIResult", complete: true, count: results.length, results }),
	);
}).listen(PORT, () => console.log(`[indico-mock] listening on ${PORT}`));
