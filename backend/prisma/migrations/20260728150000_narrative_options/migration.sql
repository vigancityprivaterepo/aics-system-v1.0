CREATE TABLE "narrative_options" (
    "id" UUID NOT NULL,
    "assistance_type" "AssistanceType" NOT NULL,
    "field" VARCHAR(30) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "narrative_options_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "narrative_options_assistance_type_field_is_active_sort_order_idx" ON "narrative_options"("assistance_type", "field", "is_active", "sort_order");
INSERT INTO "narrative_options" ("id", "assistance_type", "field", "label", "content", "sort_order", "updated_at") VALUES
(gen_random_uuid(), 'medicine', 'presenting_problem', 'Purchase of prescribed medicines', 'The client is seeking financial assistance for the purchase of prescribed medicines.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'medicine', 'findings', 'Insufficient income for medicines', 'Based on the assessment, the client has insufficient income to cover the cost of the prescribed medicines and needs immediate financial assistance.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hospital', 'presenting_problem', 'Hospital bill assistance', 'The client is seeking financial assistance for the payment of hospital expenses.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hospital', 'findings', 'Unable to settle hospital bill', 'Based on the assessment, the family has limited financial resources and is unable to settle the hospital bill without assistance.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'medical', 'presenting_problem', 'Medical procedure assistance', 'The client is seeking financial assistance for a required medical procedure or examination.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'medical', 'findings', 'Unable to afford medical procedure', 'Based on the assessment, the client cannot afford the required medical procedure or examination due to limited financial resources.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'burial', 'presenting_problem', 'Burial expense assistance', 'The client is seeking financial assistance for the burial expenses of a deceased family member.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'burial', 'findings', 'Unable to cover burial expenses', 'Based on the assessment, the bereaved family has insufficient resources to cover the necessary burial expenses.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'eyeglass', 'presenting_problem', 'Prescription eyeglasses assistance', 'The client is seeking financial assistance for the purchase of prescribed eyeglasses.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'eyeglass', 'findings', 'Unable to afford prescribed eyeglasses', 'Based on the assessment, the client has limited financial capacity and cannot afford the prescribed eyeglasses.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'plain', 'presenting_problem', 'General financial assistance', 'The client is seeking financial assistance to address an urgent household need.', 10, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'plain', 'findings', 'Financially vulnerable household', 'Based on the assessment, the household has limited income and requires assistance to address the stated urgent need.', 10, CURRENT_TIMESTAMP);