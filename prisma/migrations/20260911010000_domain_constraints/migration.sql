CREATE UNIQUE INDEX "Pregnancy_one_active_per_customer" ON "Pregnancy" ("organizationId", "customerId") WHERE "status" = 'ACTIVE';
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_status_check" CHECK ("status" IN ('ACTIVE', 'BORN', 'ENDED'));
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_score_check" CHECK ("score" BETWEEN 0 AND 100);
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_priority_check" CHECK ("priority" IN ('Baixa', 'Média', 'Alta'));
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_total_check" CHECK ("total" > 0);
ALTER TABLE "Message" ADD CONSTRAINT "Message_direction_check" CHECK ("direction" IN ('INBOUND', 'OUTBOUND'));
ALTER TABLE "Message" ADD CONSTRAINT "Message_first_outbound_check" CHECK (("direction" = 'OUTBOUND' AND "firstOutboundKey" IS NOT NULL AND "firstOutboundKey" = "conversationId") OR ("direction" = 'INBOUND' AND "firstOutboundKey" IS NULL));
