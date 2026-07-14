ALTER TABLE "SiteSettings"
ADD COLUMN "friendsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "friendsIntro" TEXT NOT NULL DEFAULT '这里收录了一些值得阅读与长期关注的朋友和站点。',
ADD COLUMN "friendsRequirements" TEXT NOT NULL DEFAULT E'网站可正常访问\n内容以原创为主\n已添加本站友链\n不含违法、侵权或低质量采集内容',
ADD COLUMN "friendsContactLabel" TEXT NOT NULL DEFAULT '联系站长',
ADD COLUMN "friendsContactUrl" TEXT NOT NULL DEFAULT '/about';

CREATE TABLE "FriendLink" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FriendLink_url_key" ON "FriendLink"("url");
CREATE INDEX "FriendLink_isVisible_sortOrder_name_idx" ON "FriendLink"("isVisible", "sortOrder", "name");
