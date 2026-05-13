-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssistanceType" AS ENUM ('medicine', 'burial', 'hospital', 'medical', 'eyeglass', 'plain');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('intake', 'requirements', 'encoding', 'for_review', 'recommending_approval', 'for_approval', 'approved', 'released', 'rejected');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('employee', 'admin');

-- CreateEnum
CREATE TYPE "ApprovalStage" AS ENUM ('for_review', 'recommending_approval', 'for_approval');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "ClientCategory" AS ENUM ('walk_in', 'referred', 'rescued');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "username" VARCHAR(50),
    "employee_id" VARCHAR(50) NOT NULL,
    "role" "UserRole" NOT NULL,
    "approval_level" VARCHAR(100) NOT NULL DEFAULT 'none',
    "signature_param" VARCHAR(50),
    "position" VARCHAR(200),
    "email" VARCHAR(200) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "e_signature_url" TEXT,
    "e_signature_uploaded_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "applicant_id" UUID,
    "case_number" VARCHAR(20) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "middle_name" VARCHAR(100),
    "date_of_birth" DATE,
    "sex" VARCHAR(10),
    "civil_status" VARCHAR(20),
    "barangay" VARCHAR(100),
    "municipality" VARCHAR(100),
    "province" VARCHAR(100),
    "region" VARCHAR(50),
    "contact_number" VARCHAR(20),
    "occupation" VARCHAR(200),
    "religion" VARCHAR(100),
    "is_4ps" BOOLEAN NOT NULL DEFAULT false,
    "is_pwd" BOOLEAN NOT NULL DEFAULT false,
    "is_senior" BOOLEAN NOT NULL DEFAULT false,
    "client_category" "ClientCategory" NOT NULL DEFAULT 'walk_in',
    "referral_source" VARCHAR(200),
    "photo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "case_number" VARCHAR(20),
    "assistance_type" "AssistanceType" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'intake',
    "social_worker_id" UUID,
    "date_of_assessment" DATE,
    "social_worker_name" VARCHAR(200),
    "social_worker_emp_id" VARCHAR(100),
    "presenting_problem" TEXT,
    "family_composition" JSONB,
    "background_of_problem" TEXT,
    "assessment" TEXT,
    "recommendation" TEXT,
    "amount" DECIMAL(12,2),
    "hospital_clinic" VARCHAR(200),
    "remarks" TEXT,
    "audit_flags" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_requirements" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "requirement_name" VARCHAR(100) NOT NULL,
    "is_submitted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "case_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medicine_items" (
    "id" UUID NOT NULL,
    "generic_name" VARCHAR(200) NOT NULL,
    "brand_name" VARCHAR(200),
    "unit" VARCHAR(50),
    "strength" VARCHAR(50),
    "category" VARCHAR(100),
    "unit_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "medicine_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hospital_facilities" (
    "id" UUID NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "municipality" VARCHAR(100) NOT NULL,
    "facility_name" VARCHAR(300) NOT NULL,
    "facility_type" VARCHAR(100) NOT NULL,
    "full_address" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "hospital_facilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_medicines" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "medicine_id" UUID,
    "medicine_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" VARCHAR(50),
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "case_medicines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "burial_details" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "deceased_name" VARCHAR(200),
    "deceased_address" VARCHAR(300),
    "deceased_age" INTEGER,
    "deceased_occupation" VARCHAR(200),
    "deceased_civil_status" VARCHAR(50),
    "deceased_sex" VARCHAR(20),
    "date_of_death" DATE,
    "cause_of_death" TEXT,
    "funeral_home" VARCHAR(200),
    "funeral_home_owner" VARCHAR(200),
    "funeral_owner_address" VARCHAR(300),
    "type_of_bill" VARCHAR(200),
    "interment_place" VARCHAR(300),
    "conforme_name" VARCHAR(200),
    "conforme_relationship" VARCHAR(100),
    "guarantee_letter_url" TEXT,
    "signed_gl_url" TEXT,
    "gl_uploaded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "burial_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "funeral_homes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "owner_name" VARCHAR(200),
    "address" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "funeral_homes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hospital_details" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "template_type" VARCHAR(20) NOT NULL DEFAULT 'personal',
    "patient_name" VARCHAR(200),
    "hospital_name" VARCHAR(200),
    "hospital_address" TEXT,
    "doctor_name" VARCHAR(200),
    "md_position" VARCHAR(200),
    "admission_date" DATE,
    "diagnosis" TEXT,
    "type_of_bill" VARCHAR(200),
    "conforme_name" VARCHAR(200),
    "conforme_relationship" VARCHAR(100),
    "guarantee_letter_url" TEXT,
    "signed_gl_url" TEXT,
    "gl_uploaded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "hospital_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medical_details" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "template_type" VARCHAR(20) NOT NULL DEFAULT 'personal',
    "clinic_name" VARCHAR(200),
    "clinic_address" TEXT,
    "doctor_name" VARCHAR(200),
    "md_position" VARCHAR(200),
    "consultation_date" DATE,
    "medical_type" VARCHAR(200),
    "diagnosed_type" VARCHAR(200),
    "operation_type" VARCHAR(200),
    "diagnosis" TEXT,
    "type_of_bill" VARCHAR(200),
    "conforme_name" VARCHAR(200),
    "conforme_relationship" VARCHAR(100),
    "guarantee_letter_url" TEXT,
    "signed_gl_url" TEXT,
    "gl_uploaded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "medical_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eyeglass_details" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "doctor_name" VARCHAR(200),
    "clinic_name" VARCHAR(200),
    "clinic_address" TEXT,
    "conforme_name" VARCHAR(200),
    "conforme_relationship" VARCHAR(100),
    "guarantee_letter_url" TEXT,
    "signed_gl_url" TEXT,
    "gl_uploaded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "eyeglass_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plain_details" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "nature_of_assistance" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "plain_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "location_code" VARCHAR(10) NOT NULL DEFAULT 'VGN',
    "agency_code" VARCHAR(10) NOT NULL DEFAULT 'AICS',
    "medicine_prefix" VARCHAR(10) NOT NULL DEFAULT 'MD',
    "burial_prefix" VARCHAR(10) NOT NULL DEFAULT 'BUR',
    "hospital_prefix" VARCHAR(10) NOT NULL DEFAULT 'HSP',
    "medical_prefix" VARCHAR(10) NOT NULL DEFAULT 'MED',
    "eyeglass_prefix" VARCHAR(10) NOT NULL DEFAULT 'EYE',
    "plain_prefix" VARCHAR(10) NOT NULL DEFAULT 'PLN',
    "client_prefix" VARCHAR(10) NOT NULL DEFAULT 'CID',
    "sequence_digits" INTEGER NOT NULL DEFAULT 3,
    "reviewed_by_user_id" UUID,
    "recommending_user_id" UUID,
    "approved_by_user_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_approvals" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "stage" "ApprovalStage" NOT NULL,
    "acted_by_user_id" UUID,
    "acted_by_name" VARCHAR(200) NOT NULL,
    "acted_by_title" VARCHAR(120),
    "signature_url_snapshot" TEXT,
    "acted_at" TIMESTAMPTZ(6) NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "case_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "applicants" (
    "id" UUID NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "mobile_number" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "otp_hash" TEXT,
    "otp_expires_at" TIMESTAMPTZ(6),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "middle_name" VARCHAR(100),
    "date_of_birth" DATE,
    "sex" VARCHAR(10),
    "civil_status" VARCHAR(20),
    "barangay" VARCHAR(100),
    "municipality" VARCHAR(100),
    "province" VARCHAR(100),
    "region" VARCHAR(50),
    "occupation" VARCHAR(200),
    "religion" VARCHAR(100),
    "is_4ps" BOOLEAN NOT NULL DEFAULT false,
    "is_pwd" BOOLEAN NOT NULL DEFAULT false,
    "is_senior" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_status_logs" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_status" "CaseStatus" NOT NULL,
    "to_status" "CaseStatus" NOT NULL,
    "notes" TEXT,
    CONSTRAINT "case_status_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");
CREATE UNIQUE INDEX "users_signature_param_key" ON "users"("signature_param");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "clients_applicant_id_key" ON "clients"("applicant_id");
CREATE UNIQUE INDEX "clients_case_number_key" ON "clients"("case_number");
CREATE INDEX "clients_last_name_first_name_date_of_birth_idx" ON "clients"("last_name", "first_name", "date_of_birth");
CREATE UNIQUE INDEX "cases_case_number_key" ON "cases"("case_number");
CREATE INDEX "cases_assistance_type_status_idx" ON "cases"("assistance_type", "status");
CREATE INDEX "cases_created_at_idx" ON "cases"("created_at");
CREATE UNIQUE INDEX "case_requirements_case_id_requirement_name_key" ON "case_requirements"("case_id", "requirement_name");
CREATE INDEX "medicine_items_generic_name_idx" ON "medicine_items"("generic_name");
CREATE INDEX "hospital_facilities_facility_name_idx" ON "hospital_facilities"("facility_name");
CREATE INDEX "hospital_facilities_province_municipality_idx" ON "hospital_facilities"("province", "municipality");
CREATE UNIQUE INDEX "burial_details_case_id_key" ON "burial_details"("case_id");
CREATE UNIQUE INDEX "hospital_details_case_id_key" ON "hospital_details"("case_id");
CREATE UNIQUE INDEX "medical_details_case_id_key" ON "medical_details"("case_id");
CREATE UNIQUE INDEX "eyeglass_details_case_id_key" ON "eyeglass_details"("case_id");
CREATE UNIQUE INDEX "plain_details_case_id_key" ON "plain_details"("case_id");
CREATE INDEX "case_approvals_case_id_acted_at_idx" ON "case_approvals"("case_id", "acted_at");
CREATE UNIQUE INDEX "case_approvals_case_id_stage_key" ON "case_approvals"("case_id", "stage");
CREATE UNIQUE INDEX "applicants_email_key" ON "applicants"("email");
CREATE INDEX "applicants_email_idx" ON "applicants"("email");
CREATE INDEX "case_status_logs_case_id_changed_at_idx" ON "case_status_logs"("case_id", "changed_at");

ALTER TABLE "clients" ADD CONSTRAINT "clients_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cases" ADD CONSTRAINT "cases_social_worker_id_fkey" FOREIGN KEY ("social_worker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_requirements" ADD CONSTRAINT "case_requirements_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_medicines" ADD CONSTRAINT "case_medicines_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_medicines" ADD CONSTRAINT "case_medicines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "burial_details" ADD CONSTRAINT "burial_details_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hospital_details" ADD CONSTRAINT "hospital_details_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medical_details" ADD CONSTRAINT "medical_details_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eyeglass_details" ADD CONSTRAINT "eyeglass_details_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plain_details" ADD CONSTRAINT "plain_details_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_recommending_user_id_fkey" FOREIGN KEY ("recommending_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_acted_by_user_id_fkey" FOREIGN KEY ("acted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_status_logs" ADD CONSTRAINT "case_status_logs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_status_logs" ADD CONSTRAINT "case_status_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
