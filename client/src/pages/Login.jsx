export default function Login() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <form className="card w-80 p-6">
        <div className="card-title mb-4">Sign in</div>
        <label className="mb-1 block text-xs text-text-secondary">Username</label>
        <input className="input-field mb-3" name="username" autoComplete="username" />
        <label className="mb-1 block text-xs text-text-secondary">Password</label>
        <input className="input-field mb-4" name="password" type="password" autoComplete="current-password" />
        <button type="submit" className="btn-primary w-full justify-center" disabled>
          Sign in (wired in Stage 2/3)
        </button>
      </form>
    </div>
  );
}
