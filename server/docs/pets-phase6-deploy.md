# Phase 6 — Medi Vet chat (schema)

Additive `PetChatSession` + `PetChatMessage`. **Do not** use `prisma db push`. Do not run this against hosted Neon unless an operator explicitly asks.

Missing chat tables return `chatSchemaReady: false` on Medi Vet routes and must not 500 identity, health, care, or reminder routes.

## Execution order

1. `pets-phase2.sql` — identity (`Pet`)
2. `pets-phase3.sql` — weight, allergies, conditions
3. `pets-phase4.sql` — products, schedules, occurrences, events
4. `pets-phase5.sql` — `PetReminderDelivery` (optional; independent of chat)
5. `pets-phase6.sql` — Medi Vet sessions/messages

```bash
cd server
npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase4.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase5.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase6.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop the Medicard API process first if `query_engine-windows.dll.node` is locked.

## Honesty

- Chat SQL is not applied by this implementation pass.
- OpenRouter keys stay on the server. VET never uses EvidenceMD.
- Attachments are deferred. Text chat is the complete v1 path.
