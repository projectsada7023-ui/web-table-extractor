import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Web Table Extractor",
  description: "Privacy policy for the Web Table Extractor Microsoft Edge extension.",
};

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "40px 20px 80px" }}>
      <div
        style={{
          width: "min(900px, 100%)",
          margin: "0 auto",
          background: "rgba(15,23,42,.86)",
          border: "1px solid rgba(148,163,184,.16)",
          borderRadius: "20px",
          padding: "clamp(22px, 5vw, 44px)",
          boxShadow: "0 24px 70px rgba(0,0,0,.32)",
        }}
      >
        <Link href="/" style={{ color: "#a5b4fc", textDecoration: "none", fontSize: "13px" }}>
          ← Web Table Extractor
        </Link>

        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", margin: "24px 0 10px" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#94a3b8", marginTop: 0 }}>
          Web Table Extractor — Microsoft Edge extension
        </p>
        <p style={{ color: "#94a3b8", fontSize: "13px" }}>
          Effective date: September 25, 2026
        </p>

        <Section title="1. Scope">
          <p>
            This Privacy Policy applies to the Web Table Extractor browser extension published for
            Microsoft Edge. It explains what information the extension accesses, how that information
            is used, and what is not collected or shared.
          </p>
          <p>
            The extension's purpose is to detect HTML tables on the webpage the user is viewing and
            allow the user to preview and export the selected table as CSV or Excel.
          </p>
        </Section>

        <Section title="2. Information the extension accesses">
          <p>
            When the user invokes the extension on a webpage, it may access the webpage DOM and
            HTML table content needed to perform table extraction. The extension may also read the
            current page title and URL so the extraction can be identified in the extension interface.
          </p>
          <p>
            Webpage content can contain information about people or other parties. The extension
            processes the selected table data locally in the browser for the requested extraction
            and export feature.
          </p>
        </Section>

        <Section title="3. Information we collect">
          <p>
            The Web Table Extractor extension does not intentionally collect, store, sell, rent, or
            transmit extracted webpage table contents to a remote server.
          </p>
          <ul>
            <li>No browsing-history database is maintained by the extension.</li>
            <li>No advertising profile or behavioral tracking profile is created by the extension.</li>
            <li>No passwords, authentication tokens, payment details, health information, or location data are requested by the extension.</li>
            <li>Exported CSV and Excel files are created and saved on the user's device when the user chooses an export action.</li>
          </ul>
        </Section>

        <Section title="4. How permissions are used">
          <ul>
            <li>
              <strong>activeTab:</strong> used to access the currently active webpage for the table
              extraction feature after the user chooses to use the extension.
            </li>
            <li>
              <strong>scripting:</strong> used to run the table extraction code on the active webpage.
            </li>
            <li>
              <strong>downloads:</strong> used to save CSV or Excel files to the user's device after
              the user clicks an export button.
            </li>
          </ul>
          <p>
            These permissions are used only for the extension's table extraction and export
            functionality.
          </p>
        </Section>

        <Section title="5. Data sharing and third parties">
          <p>
            The extension does not sell or transfer extracted table data to third parties. The
            extension does not use an external analytics, advertising, or data-broker service to
            collect the table data it processes.
          </p>
          <p>
            The extension's CSV and Excel exports are generated for the user and saved through the
            browser's download mechanism. The user controls where downloaded files are stored and
            what happens to those files afterward.
          </p>
        </Section>

        <Section title="6. Data retention and deletion">
          <p>
            The extension does not maintain a remote database of extracted table contents. Data
            processed in the extension remains in the browser session unless the user chooses to
            export, copy, or otherwise retain it.
          </p>
          <p>
            Exported files are stored on the user's device according to the user's browser and
            operating-system settings. The user can delete exported files at any time.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            Web Table Extractor is designed to minimize data transmission by processing extraction
            results locally in the extension. The extension does not intentionally transmit extracted
            table content over an insecure channel.
          </p>
          <p>
            Users should avoid extracting or exporting information they are not authorized to access
            or use, and should follow the privacy and access rules of the websites they visit.
          </p>
        </Section>

        <Section title="8. User control">
          <p>
            The user decides when to invoke the extension, which detected table to export, and
            whether to save or share an exported file. The extension does not intentionally collect
            or share extracted table data without the user's interaction with the extraction or
            export feature.
          </p>
          <p>
            Users can disable or uninstall the extension through Microsoft Edge at any time.
          </p>
        </Section>

        <Section title="9. Children's privacy">
          <p>
            The extension is a general productivity and data-extraction tool. It is not designed to
            knowingly collect personal information from children.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            This Privacy Policy may be updated when the extension's functionality, data practices,
            or legal requirements change. The effective date at the top of this page will be updated
            when material changes are made.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            For privacy questions or requests concerning Web Table Extractor, contact the publisher
            through the support contact provided on the Microsoft Edge Add-ons listing.
          </p>
        </Section>

        <div
          style={{
            marginTop: "30px",
            paddingTop: "18px",
            borderTop: "1px solid rgba(148,163,184,.12)",
            color: "#64748b",
            fontSize: "12px",
            lineHeight: 1.6,
          }}
        >
          Web Table Extractor is an independent productivity extension and is not affiliated with
          Microsoft.
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: "28px" }}>
      <h2 style={{ fontSize: "19px", margin: "0 0 10px", color: "#f8fafc" }}>{title}</h2>
      <div style={{ color: "#cbd5e1", lineHeight: 1.75, fontSize: "14px" }}>{children}</div>
    </section>
  );
}
