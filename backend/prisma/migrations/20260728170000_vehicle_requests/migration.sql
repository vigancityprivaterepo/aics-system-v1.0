CREATE SEQUENCE "vehicle_request_number_seq" START 1;

CREATE TABLE "vehicle_requests" (
    "id" UUID NOT NULL,
    "request_number" VARCHAR(30) NOT NULL,
    "vehicle_type" VARCHAR(30) NOT NULL,
    "other_vehicle" VARCHAR(150),
    "request_date" DATE NOT NULL,
    "requested_by" VARCHAR(200) NOT NULL,
    "office" VARCHAR(200) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "purpose" TEXT NOT NULL,
    "destination" VARCHAR(300) NOT NULL,
    "departure_date" DATE NOT NULL,
    "departure_time" VARCHAR(20) NOT NULL,
    "arrival_date" DATE NOT NULL,
    "arrival_time" VARCHAR(20) NOT NULL,
    "number_of_passengers" INTEGER NOT NULL,
    "availability" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "vehicle_model" VARCHAR(150),
    "unavailable_reason" TEXT,
    "plate_number" VARCHAR(50),
    "alternative_vehicle" VARCHAR(150),
    "alternative_model" VARCHAR(150),
    "alternative_plate" VARCHAR(50),
    "driver_per_diem" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rental_fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "toll_fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fuel_expenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "vehicle_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "vehicle_requests_request_number_key" ON "vehicle_requests"("request_number");
CREATE INDEX "vehicle_requests_request_date_idx" ON "vehicle_requests"("request_date");
CREATE INDEX "vehicle_requests_status_idx" ON "vehicle_requests"("status");
CREATE INDEX "vehicle_requests_vehicle_type_idx" ON "vehicle_requests"("vehicle_type");