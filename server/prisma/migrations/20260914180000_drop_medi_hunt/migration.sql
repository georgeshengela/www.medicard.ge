-- Drop Medi Hunt tables only. Does not touch RewardLedger, users, or Classic Run.
DROP INDEX IF EXISTS "HuntSession_userId_open_uidx";
DROP TABLE IF EXISTS "HuntCapture";
DROP TABLE IF EXISTS "HuntSuspicious";
DROP TABLE IF EXISTS "HuntQaGrant";
DROP TABLE IF EXISTS "HuntProgress";
DROP TABLE IF EXISTS "HuntGraphCache";
DROP TABLE IF EXISTS "HuntSession";
DROP TABLE IF EXISTS "HuntConfig";
