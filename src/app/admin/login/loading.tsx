export default function AdminLoginLoading() {
  return (
    <main aria-busy="true" aria-label="正在加载登录页面" className="admin-login">
      <div className="admin-login__toolbar"><span>Prelog 管理台</span></div>
      <section className="admin-login__panel admin-login__panel--loading">
        <span className="sr-only">正在加载登录页面</span>
        <span />
        <span />
        <span />
      </section>
    </main>
  );
}
