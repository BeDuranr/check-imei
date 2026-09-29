export function ReportTable({ raw }: { raw: Record<string, string> }) {
  const entries = Object.entries(raw);
  if (!entries.length) return <p className="text-sm text-muted">Sin datos.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} className="border-t border-line align-top">
            <th scope="row" className="w-2/5 py-1.5 pr-3 text-left font-normal text-muted">
              {key}
            </th>
            <td className="break-all py-1.5">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
