import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { TypographicAscii } from "@/components/typographic-ascii";
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
      <main>
        <section className="page-heading">
          <TypographicAscii text={`About ${settings.siteName}`} tone="compact" />
          <span className="eyebrow">About</span>
          <h1>{settings.aboutTitle}</h1>
          <p>{settings.aboutIntro}</p>
        </section>

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
      </main>
    </PageShell>
  );
}
