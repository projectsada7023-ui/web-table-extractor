"use client";

const demoRows = [
  ["Acme Store", "Wireless Mouse", "₹799", "4.5"],
  ["TechWorld", "Mechanical Keyboard", "₹2,499", "4.7"],
  ["SmartShop", "USB-C Hub", "₹1,299", "4.4"],
  ["Digital Mart", "Laptop Stand", "₹999", "4.6"],
  ["OfficePro", "Webcam", "₹1,899", "4.3"],
  ["Gadget House", "USB Microphone", "₹2,199", "4.8"]
];

export default function ExtensionDemoPage() {
  return (
    <main className="demo-page">
      <section className="demo-shell">
        <div className="demo-badge">Web Table Extractor · Extension Demo</div>
        <h1>Extract web tables in seconds.</h1>
        <p className="demo-lead">
          This clean demo page contains a real HTML table. Open the Web Table Extractor
          browser extension to detect the table and export it as CSV.
        </p>

        <div className="demo-instruction">
          <span className="demo-step">1</span>
          <div>
            <strong>Open the Web Table Extractor extension</strong>
            <span>Select the detected table, preview the data, and export it as CSV.</span>
          </div>
        </div>

        <div className="demo-table-card">
          <div className="demo-table-heading">
            <div>
              <span className="demo-kicker">Sample product data</span>
              <h2>Product catalog</h2>
            </div>
            <span className="demo-table-count">{demoRows.length} rows · 4 columns</span>
          </div>

          <div className="demo-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {demoRows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => <td key={cell}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="demo-note">
          Demo data is illustrative and provided only to demonstrate table extraction.
        </p>
      </section>

      <style jsx>{`
        .demo-page {
          min-height: 100vh;
          padding: 92px 20px 80px;
          background:
            radial-gradient(circle at 50% 0%, rgba(99,102,241,.16), transparent 34rem),
            #070a12;
          color: #e5e7eb;
        }
        .demo-shell {
          width: min(1050px, 100%);
          margin: 0 auto;
        }
        .demo-badge {
          display: inline-flex;
          align-items: center;
          padding: 7px 11px;
          border: 1px solid rgba(129,140,248,.24);
          border-radius: 999px;
          background: rgba(99,102,241,.08);
          color: #a5b4fc;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .04em;
        }
        h1 {
          margin: 18px 0 12px;
          max-width: 760px;
          font-size: clamp(42px, 6vw, 66px);
          line-height: .98;
          letter-spacing: -.055em;
        }
        .demo-lead {
          max-width: 720px;
          margin: 0;
          color: #94a3b8;
          font-size: 17px;
          line-height: 1.7;
        }
        .demo-instruction {
          display: flex;
          align-items: center;
          gap: 13px;
          margin: 30px 0 18px;
          padding: 14px 16px;
          border: 1px solid rgba(148,163,184,.13);
          border-radius: 14px;
          background: rgba(15,23,42,.62);
        }
        .demo-step {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          border-radius: 9px;
          background: linear-gradient(135deg,#6366f1,#4f46e5);
          color: white;
          font-size: 13px;
          font-weight: 900;
        }
        .demo-instruction strong,
        .demo-instruction span {
          display: block;
        }
        .demo-instruction strong {
          margin-bottom: 3px;
          color: #f8fafc;
          font-size: 13px;
        }
        .demo-instruction span:last-child {
          color: #64748b;
          font-size: 12px;
        }
        .demo-table-card {
          overflow: hidden;
          border: 1px solid rgba(148,163,184,.16);
          border-radius: 18px;
          background: rgba(15,23,42,.72);
          box-shadow: 0 25px 70px rgba(0,0,0,.28);
        }
        .demo-table-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 19px 21px;
          border-bottom: 1px solid rgba(148,163,184,.1);
        }
        .demo-kicker {
          display: block;
          margin-bottom: 4px;
          color: #818cf8;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .demo-table-heading h2 {
          margin: 0;
          color: #f8fafc;
          font-size: 21px;
          letter-spacing: -.025em;
        }
        .demo-table-count {
          color: #64748b;
          font-size: 12px;
          white-space: nowrap;
        }
        .demo-table-wrap {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
        }
        th, td {
          padding: 14px 18px;
          text-align: left;
          border-bottom: 1px solid rgba(148,163,184,.09);
        }
        th {
          background: rgba(30,41,59,.72);
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        td {
          color: #dbe4f0;
          font-size: 14px;
        }
        tbody tr:nth-child(even) {
          background: rgba(148,163,184,.025);
        }
        tbody tr:hover {
          background: rgba(99,102,241,.07);
        }
        tbody tr:last-child td {
          border-bottom: 0;
        }
        .demo-note {
          margin: 12px 2px 0;
          color: #475569;
          font-size: 11px;
        }
        @media (max-width: 700px) {
          .demo-page { padding: 58px 12px 50px; }
          .demo-lead { font-size: 15px; }
          .demo-table-heading { align-items: flex-start; flex-direction: column; }
          .demo-instruction { align-items: flex-start; }
        }
      `}
      </style>
    </main>
  );
}
