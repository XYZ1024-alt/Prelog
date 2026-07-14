import { Check, ExternalLink, Link2, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FriendLogo } from "@/components/friend-logo";
import { PageHeading } from "@/components/page-heading";
import { PageShell } from "@/components/page-shell";
import {
  getPublicFriendLinks,
} from "@/lib/friend-links";
import { getFriendLinkHostname, splitFriendRequirements } from "@/lib/friend-link-utils";
import { getSiteSettings } from "@/lib/site-settings";
import { createPageMetadataAlternates, getSiteUrl } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  if (!settings.friendsEnabled) {
    notFound();
  }

  return {
    alternates: createPageMetadataAlternates("/friends"),
    description: settings.friendsIntro,
    title: "友情链接",
  };
}

export default async function FriendsPage() {
  const settings = await getSiteSettings();

  if (!settings.friendsEnabled) {
    notFound();
  }

  const friendLinks = await getPublicFriendLinks();
  const requirements = splitFriendRequirements(settings.friendsRequirements);
  const siteUrl = getSiteUrl().toString();

  return (
    <PageShell className="friends-page">
      <PageHeading
        description={settings.friendsIntro}
        icon={Link2}
        label="站点网络"
        title="友情链接"
      />
      <section aria-labelledby="friend-directory-title" className="friend-directory content-band">
        <header className="section-heading section-heading--compact">
          <h2 id="friend-directory-title">值得访问的站点</h2>
          <span>{friendLinks.length} 个站点</span>
        </header>
        {friendLinks.length > 0 ? (
          <div className="friend-grid">
            {friendLinks.map((friendLink) => (
              <a
                className="friend-link"
                href={friendLink.url}
                key={friendLink.id}
                rel="noopener noreferrer"
                target="_blank"
              >
                <FriendLogo logoUrl={friendLink.logoUrl} name={friendLink.name} />
                <span className="friend-link__content">
                  <span className="friend-link__title">
                    <strong>{friendLink.name}</strong>
                    <ExternalLink aria-hidden="true" size={15} />
                  </span>
                  <span className="friend-link__host">{getFriendLinkHostname(friendLink.url)}</span>
                  <span className="friend-link__description">{friendLink.description}</span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="friend-empty">友链正在整理中。</p>
        )}
      </section>
      <section aria-labelledby="friend-exchange-title" className="friend-exchange">
        <div className="friend-exchange__intro">
          <h2 id="friend-exchange-title">把彼此放进长期阅读列表</h2>
          <p>{settings.friendsIntro}</p>
          <ContactLink href={settings.friendsContactUrl} label={settings.friendsContactLabel} />
        </div>
        <div className="friend-exchange__details">
          <dl className="friend-site-profile">
            <div>
              <dt>本站名称</dt>
              <dd>{settings.siteName}</dd>
            </div>
            <div>
              <dt>本站地址</dt>
              <dd>{siteUrl}</dd>
            </div>
            <div>
              <dt>本站描述</dt>
              <dd>{settings.siteTagline}</dd>
            </div>
          </dl>
          {requirements.length > 0 ? (
            <div className="friend-requirements">
              <h3>收录要求</h3>
              <ul>
                {requirements.map((requirement) => (
                  <li key={requirement}>
                    <Check aria-hidden="true" size={14} />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}

function ContactLink({ href, label }: { readonly href: string; readonly label: string }) {
  const content = (
    <>
      <Send aria-hidden="true" size={16} />
      {label}
    </>
  );

  if (href.startsWith("/")) {
    return <Link className="button button--primary" href={href}>{content}</Link>;
  }

  const opensNewTab = href.startsWith("https://");
  return (
    <a
      className="button button--primary"
      href={href}
      rel={opensNewTab ? "noopener noreferrer" : undefined}
      target={opensNewTab ? "_blank" : undefined}
    >
      {content}
    </a>
  );
}
