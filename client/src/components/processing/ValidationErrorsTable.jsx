import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function ValidationErrorsTable({ files, validationResults }) {
  const [copied, setCopied] = useState(false);

  const failuresByFile = new Map();
  for (const r of validationResults) {
    if (r.Result !== 'FAIL') continue;
    const file = files.find((f) => f.Id === r.ProcessingFileId);
    if (!file) continue;
    if (!failuresByFile.has(file.SourceFilename)) failuresByFile.set(file.SourceFilename, []);
    failuresByFile.get(file.SourceFilename).push(r);
  }

  if (failuresByFile.size === 0) return null;

  function handleCopy() {
    const lines = ['LED Asset Validation Issues', '', 'The following assets require correction:', ''];
    let i = 1;
    for (const [filename, failures] of failuresByFile) {
      lines.push(`${i}. ${filename}`);
      for (const f of failures) lines.push(`   - ${f.FailureReason}`);
      lines.push('');
      i += 1;
    }
    lines.push('Please replace/correct the affected files and re-upload them to the SharePoint source folder.');
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="card-title text-danger">Validation errors</div>
        <button className="btn-secondary text-xs" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy for Partnership/Media'}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-secondary">
            <th className="py-2 pr-3">Filename</th>
            <th className="py-2 pr-3">Failure reason</th>
          </tr>
        </thead>
        <tbody>
          {[...failuresByFile.entries()].map(([filename, failures]) =>
            failures.map((f, idx) => (
              <tr key={`${filename}-${idx}`} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 font-mono">{idx === 0 ? filename : ''}</td>
                <td className="py-2 pr-3 text-danger">{f.FailureReason}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
