CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "siteTagline" TEXT NOT NULL,
    "heroTitle" TEXT NOT NULL,
    "heroExcerpt" TEXT NOT NULL,
    "aboutTitle" TEXT NOT NULL,
    "aboutIntro" TEXT NOT NULL,
    "aboutWriting" TEXT NOT NULL,
    "aboutAudience" TEXT NOT NULL,
    "aboutTopics" TEXT NOT NULL,
    "footerPrimary" TEXT NOT NULL,
    "footerSecondary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
