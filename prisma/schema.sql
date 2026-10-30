-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstName" TEXT,
    "login" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OPERATEUR',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identifierPrefix" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isLaserEnabled" BOOLEAN NOT NULL DEFAULT false,
    "protectAppModified" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dynamicData" JSONB NOT NULL,
    "uniqueIdentifier" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'A_ENROLER',
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrollmentNumber" TEXT,
    "photoConflict" BOOLEAN NOT NULL DEFAULT false,
    "photoHash" TEXT,
    "deliveryBatchId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrolledBy" TEXT,
    "printedBy" TEXT,
    "cardNumber" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "appModified" BOOLEAN NOT NULL DEFAULT false,
    "externalQrUrl" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 324,
    "height" INTEGER NOT NULL DEFAULT 204,
    "backgroundUrl" TEXT,
    "layoutConfig" JSONB NOT NULL,
    "categoryId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'BADGE',

    CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardFormat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 85.6,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 53.98,
    "unit" TEXT NOT NULL DEFAULT 'mm',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "CardFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "formatId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "validityUnit" TEXT DEFAULT 'YEAR',
    "validityValue" INTEGER DEFAULT 1,
    "cardCode" TEXT NOT NULL DEFAULT '',
    "documentTypeSlug" TEXT,

    CONSTRAINT "CardCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPhysicalType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "cardCode" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CardPhysicalType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchNumber" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "signedProof" TEXT,
    "signedProofName" TEXT,
    "signedProofType" TEXT,
    "cardDocumentTypeSlug" TEXT,

    CONSTRAINT "DeliveryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardDocumentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cardCode" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CardDocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "categoryId" TEXT,
    "physicalTypeId" TEXT,
    "isReprint" BOOLEAN NOT NULL DEFAULT false,
    "reprintReason" TEXT,
    "printedBy" TEXT NOT NULL,
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_name_key" ON "CustomRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_slug_key" ON "CustomRole"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_uniqueIdentifier_key" ON "Employee"("companyId", "uniqueIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "CardTemplate_companyId_type_categoryId_key" ON "CardTemplate"("companyId", "type", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CardFormat_companyId_name_key" ON "CardFormat"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CardCategory_companyId_name_key" ON "CardCategory"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CardCategory_companyId_slug_key" ON "CardCategory"("companyId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CardPhysicalType_companyId_name_key" ON "CardPhysicalType"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CardPhysicalType_companyId_slug_key" ON "CardPhysicalType"("companyId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryBatch_batchNumber_key" ON "DeliveryBatch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CardDocumentType_companyId_name_key" ON "CardDocumentType"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CardDocumentType_companyId_slug_key" ON "CardDocumentType"("companyId", "slug");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_deliveryBatchId_fkey" FOREIGN KEY ("deliveryBatchId") REFERENCES "DeliveryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CardCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardFormat" ADD CONSTRAINT "CardFormat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCategory" ADD CONSTRAINT "CardCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCategory" ADD CONSTRAINT "CardCategory_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "CardFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPhysicalType" ADD CONSTRAINT "CardPhysicalType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardDocumentType" ADD CONSTRAINT "CardDocumentType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
