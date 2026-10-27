import { PageHeader } from '../components/ui.jsx';
import ArchitectureFlow from '../components/ArchitectureFlow.jsx';
import { LinkIcon } from '../components/Icons.jsx';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/students/{id}',
    purpose: 'Read an authorized student profile',
  },
  {
    method: 'POST',
    path: '/api/enrollments',
    purpose: 'Create an enrollment record',
  },
  {
    method: 'GET',
    path: '/api/students/{id}/schedule',
    purpose: "Retrieve the student's class schedule",
  },
  {
    method: 'POST',
    path: '/api/library/loans',
    purpose: 'Record a book loan',
  },
  {
    method: 'PATCH',
    path: '/api/library/loans/{id}/return',
    purpose: 'Mark a loan as returned',
  },
  {
    method: 'GET',
    path: '/api/reports/overview',
    purpose: 'Read the cross-module reporting summary',
  },
];

const WORKFLOW = [
  'The registrar creates a student profile from the Students workspace.',
  'The enrollment record references the shared student ID and course ID.',
  'The enrollment service emits a StudentEnrolled event to connected modules.',
  'Attendance, library, billing, and notifications update their authorized views.',
  'The student portal displays the refreshed schedule, loans, and account status.',
];

export default function Integration() {
  return (
    <div className="page">
      <PageHeader
        title="System Integration"
        subtitle="How SIS modules exchange information through shared data and secure APIs."
      />

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Layered Architecture</h2>
            <p className="card-sub">Each layer only talks to the layer it depends on</p>
          </div>
          <span className="card-icon">
            <LinkIcon size={18} />
          </span>
        </div>
        <ArchitectureFlow />
      </section>

      <div className="integration-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">API Endpoints</h2>
              <p className="card-sub">Interfaces that connect the system modules</p>
            </div>
          </div>
          <div className="endpoint-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((endpoint) => (
                  <tr key={`${endpoint.method}-${endpoint.path}`}>
                    <td>
                      <span className={`method method-${endpoint.method.toLowerCase()}`}>
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="mono endpoint-path">{endpoint.path}</td>
                    <td className="endpoint-purpose">{endpoint.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="integration-note">
            API responses include HTTP status codes, validation errors, and consistent JSON
            fields. Mutating requests are recorded in the audit trail.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Integration Workflow</h2>
              <p className="card-sub">One end-to-end enrollment and loan flow</p>
            </div>
          </div>
          <ol className="workflow">
            {WORKFLOW.map((step, index) => (
              <li key={step}>
                <span className="workflow-step">{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <div className="sync-note">
            <span className="sync-dot" />
            <p>
              Shared keys, transactions, and audit logging keep every connected module consistent
              after each event.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
