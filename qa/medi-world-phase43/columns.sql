SELECT column_name
FROM information_schema.columns
WHERE table_name IN ('WorldMovementSession', 'WorldMovementPreference')
ORDER BY table_name, ordinal_position;
