-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('MODERATOR', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "DefaultRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "nameKey" TEXT,
    "avatarUrl" TEXT,
    "avatarKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,

    CONSTRAINT "oauth_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tierlist" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "defaultRole" "DefaultRole",
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tierlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "userId" UUID NOT NULL,
    "tierlistId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("userId","tierlistId")
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL,
    "tierlistId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" TEXT NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card" (
    "id" UUID NOT NULL,
    "tierlistId" UUID NOT NULL,
    "categoryId" UUID,
    "title" TEXT NOT NULL,
    "imageKey" TEXT,
    "position" TEXT NOT NULL,

    CONSTRAINT "card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tierlist_op" (
    "tierlistId" UUID NOT NULL,
    "rev" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "authorId" UUID,
    "clientOpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tierlist_op_pkey" PRIMARY KEY ("tierlistId","rev")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL,
    "tierlistId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "tokenHash" TEXT,
    "inviteeId" UUID,
    "createdById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_name_key" ON "user"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_nameKey_key" ON "user"("nameKey");

-- CreateIndex
CREATE INDEX "oauth_account_userId_idx" ON "oauth_account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_account_provider_providerUserId_key" ON "oauth_account"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "tierlist_ownerId_idx" ON "tierlist"("ownerId");

-- CreateIndex
CREATE INDEX "tierlist_defaultRole_idx" ON "tierlist"("defaultRole");

-- CreateIndex
CREATE INDEX "membership_tierlistId_idx" ON "membership"("tierlistId");

-- CreateIndex
CREATE INDEX "category_tierlistId_idx" ON "category"("tierlistId");

-- CreateIndex
CREATE INDEX "card_tierlistId_idx" ON "card"("tierlistId");

-- CreateIndex
CREATE UNIQUE INDEX "tierlist_op_tierlistId_clientOpId_key" ON "tierlist_op"("tierlistId", "clientOpId");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokenHash_key" ON "invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "invitation_inviteeId_idx" ON "invitation"("inviteeId");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tierlistId_inviteeId_key" ON "invitation"("tierlistId", "inviteeId");

-- AddForeignKey
ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tierlist" ADD CONSTRAINT "tierlist_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_tierlistId_fkey" FOREIGN KEY ("tierlistId") REFERENCES "tierlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_tierlistId_fkey" FOREIGN KEY ("tierlistId") REFERENCES "tierlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_tierlistId_fkey" FOREIGN KEY ("tierlistId") REFERENCES "tierlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tierlist_op" ADD CONSTRAINT "tierlist_op_tierlistId_fkey" FOREIGN KEY ("tierlistId") REFERENCES "tierlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tierlist_op" ADD CONSTRAINT "tierlist_op_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_tierlistId_fkey" FOREIGN KEY ("tierlistId") REFERENCES "tierlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

