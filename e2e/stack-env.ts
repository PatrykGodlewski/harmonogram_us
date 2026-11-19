// The e2e stack runs as its own compose project (e2e/ports.env); fixtures and load tests
// reach its database directly. Import this before anything that reads env.
process.env.DATABASE_URL ??=
	"postgresql://postgres:postgres@localhost:15432/harmonogram_us";
process.env.E2E_WEB_URL ??= "http://localhost:3100";
process.env.E2E_ADMIN_URL ??= "http://localhost:3101";
process.env.E2E_MAILPIT_URL ??= "http://localhost:18025";
