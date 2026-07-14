import type { Metadata } from "next";

import { PageHeading } from "@/components/page-heading";
import { PageShell } from "@/components/page-shell";
import { getSiteSettings, splitAboutTopics } from "@/lib/site-settings";
import { createPageMetadataAlternates } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    alternates: createPageMetadataAlternates("/about"),
    description: settings.aboutIntro,
    title: "关于",
  };
}

export default async function AboutPage() {
  const settings = await getSiteSettings();
  const topics = splitAboutTopics(settings.aboutTopics);

  return (
    <PageShell>
      <PageHeading description={settings.aboutIntro} label="关于本站" title={settings.aboutTitle} />
      <section className="content-band about-content">
        <div>
          <h2>写什么</h2>
          <p>{settings.aboutWriting}</p>
        </div>
        <div>
          <h2>给谁看</h2>
          <p>{settings.aboutAudience}</p>
        </div>
        <div>
          <h2>常见主题</h2>
          <div className="tag-row">
            {topics.map((topic) => (
              <span className="tag" key={topic}>
                {topic}
              </span>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
