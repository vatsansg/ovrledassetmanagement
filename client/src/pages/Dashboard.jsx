export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="card p-4">
        <div className="card-title">Configuration status</div>
        <p className="mt-2 text-sm text-text-secondary">Not available</p>
      </div>
      <div className="card p-4">
        <div className="card-title">Last run</div>
        <p className="mt-2 text-sm text-text-secondary">Not available</p>
      </div>
      <div className="card p-4">
        <div className="card-title">SharePoint connection</div>
        <p className="mt-2 text-sm text-text-secondary">Not available</p>
      </div>
    </div>
  );
}
