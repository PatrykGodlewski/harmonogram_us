import { sql } from "drizzle-orm";
import type { db } from "../client";

type DbClient = typeof db;
type TransactionClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

type TxidRow = {
	txid: string;
};

export async function getCurrentTxId(tx: TransactionClient): Promise<number> {
	const result = await tx.execute<TxidRow>(
		sql`SELECT pg_current_xact_id()::xid::text AS txid`,
	);
	const txid = result[0]?.txid;

	if (txid === undefined) {
		throw new Error("Failed to get transaction ID");
	}

	return Number.parseInt(txid, 10);
}
