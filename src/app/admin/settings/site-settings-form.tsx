type SiteSettingsFormProps = {
  readonly action: (formData: FormData) => Promise<void>;
  readonly defaults: {
    readonly aboutAudience: string;
    readonly aboutIntro: string;
    readonly aboutTitle: string;
    readonly aboutTopics: string;
    readonly aboutWriting: string;
    readonly footerPrimary: string;
    readonly footerSecondary: string;
    readonly heroExcerpt: string;
    readonly heroTitle: string;
    readonly siteName: string;
    readonly siteTagline: string;
  };
};

export function SiteSettingsForm({ action, defaults }: SiteSettingsFormProps) {
  return (
    <form action={action} className="post-editor">
      <div className="form-grid">
        <label>
          站点名称
          <input defaultValue={defaults.siteName} name="siteName" required />
        </label>
        <label>
          站点标语
          <input defaultValue={defaults.siteTagline} name="siteTagline" required />
        </label>
      </div>
      <div className="form-grid">
        <label>
          首页主标题
          <input defaultValue={defaults.heroTitle} name="heroTitle" required />
        </label>
        <label>
          首页副标题
          <input defaultValue={defaults.heroExcerpt} name="heroExcerpt" required />
        </label>
      </div>
      <div className="form-grid">
        <label>
          关于页标题
          <input defaultValue={defaults.aboutTitle} name="aboutTitle" required />
        </label>
        <label>
          常见主题
          <input defaultValue={defaults.aboutTopics} name="aboutTopics" placeholder="前端开发, AI 应用, 产品设计思考" required />
        </label>
      </div>
      <label>
        关于页简介
        <textarea defaultValue={defaults.aboutIntro} name="aboutIntro" required rows={4} />
      </label>
      <label>
        关于页“写什么”
        <textarea defaultValue={defaults.aboutWriting} name="aboutWriting" required rows={4} />
      </label>
      <label>
        关于页“给谁看”
        <textarea defaultValue={defaults.aboutAudience} name="aboutAudience" required rows={4} />
      </label>
      <label>
        页脚主文案
        <textarea defaultValue={defaults.footerPrimary} name="footerPrimary" required rows={3} />
      </label>
      <label>
        页脚副文案
        <textarea defaultValue={defaults.footerSecondary} name="footerSecondary" required rows={3} />
      </label>
      <button className="button button--primary" type="submit">
        保存站点设置
      </button>
    </form>
  );
}
