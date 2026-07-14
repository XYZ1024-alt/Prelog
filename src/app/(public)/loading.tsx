export default function PublicLoading() {
  return (
    <main aria-busy="true" aria-label="正在加载页面" className="page-shell route-loading">
      <span className="sr-only">正在加载页面</span>
      <span className="route-loading__line route-loading__line--label" />
      <span className="route-loading__line route-loading__line--title" />
      <span className="route-loading__line route-loading__line--body" />
      <span className="route-loading__media" />
    </main>
  );
}
