import dayjs from "dayjs";
import HttpError from "../utils/httpError.js";


export async function generateDocNo(conn, companyId, docType, issueDate) {

  const [[cfg]] = await conn.query(
    `
    SELECT *
    FROM company_doc_configs
    WHERE company_id=:companyId AND doc_type=:docType AND is_enabled=1
    LIMIT 1
    `,
    { companyId, docType },
  );
  if (!cfg) {
    throw new HttpError(400, `Document config not found for ${docType}`);
  }

  const d = dayjs(issueDate);
  let periodKey = "GLOBAL";
  if (cfg.reset_policy === "MONTHLY") periodKey = d.format("YYYY-MM");
  if (cfg.reset_policy === "YEARLY") periodKey = d.format("YYYY");
  if (cfg.reset_policy === "DAILY") periodKey = d.format("YYYY-MM-DD");

  const [rows] = await conn.query(
    `
    SELECT last_seq
    FROM company_doc_sequences
    WHERE company_id=:companyId AND doc_type=:docType AND period_key=:periodKey
    FOR UPDATE
    `,
    { companyId, docType, periodKey },
  );

  let nextSeq = 1;

  if (rows.length === 0) {
    await conn.query(
      `
      INSERT INTO company_doc_sequences
        (company_id, doc_type, period_key, last_seq)
      VALUES
        (:companyId, :docType, :periodKey, 1)
      `,
      { companyId, docType, periodKey },
    );
  } else {
    nextSeq = rows[0].last_seq + 1;
    await conn.query(
      `
      UPDATE company_doc_sequences
      SET last_seq=:nextSeq
      WHERE company_id=:companyId AND doc_type=:docType AND period_key=:periodKey
      `,
      { nextSeq, companyId, docType, periodKey },
    );
  }


  const seq4 = String(nextSeq).padStart(4, "0");

  let dateStr = d.format("YYYYMM");
  if (cfg.reset_policy === "DAILY") dateStr = d.format("YYYYMMDD");
  else if (cfg.reset_policy === "YEARLY") dateStr = d.format("YYYY");

  const docNo =
    cfg.prefix +
    dateStr +
    "-" +
    seq4;

  return docNo;
}


export async function peekNextDocNo(conn, companyId, docType, issueDate) {
  const [[cfg]] = await conn.query(
    `
    SELECT *
    FROM company_doc_configs
    WHERE company_id=:companyId AND doc_type=:docType AND is_enabled=1
    LIMIT 1
    `,
    { companyId, docType },
  );
  if (!cfg) {
    throw new HttpError(400, `Document config not found for ${docType}`);
  }

  const d = dayjs(issueDate);
  let periodKey = "GLOBAL";
  if (cfg.reset_policy === "MONTHLY") periodKey = d.format("YYYY-MM");
  if (cfg.reset_policy === "YEARLY") periodKey = d.format("YYYY");
  if (cfg.reset_policy === "DAILY") periodKey = d.format("YYYY-MM-DD");

  const [rows] = await conn.query(
    `
    SELECT last_seq
    FROM company_doc_sequences
    WHERE company_id=:companyId AND doc_type=:docType AND period_key=:periodKey
    `,
    { companyId, docType, periodKey },
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    nextSeq = rows[0].last_seq + 1;
  }

  const seq4 = String(nextSeq).padStart(4, "0");

  let dateStr = d.format("YYYYMM");
  if (cfg.reset_policy === "DAILY") dateStr = d.format("YYYYMMDD");
  else if (cfg.reset_policy === "YEARLY") dateStr = d.format("YYYY");

  const docNo =
    cfg.prefix +
    dateStr +
    "-" +
    seq4;

  return docNo;
}
