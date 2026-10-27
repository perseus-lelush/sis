import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, formatDate, formatMoney } from '../lib/api.js';
import { INVOICE_FILTERS } from '../lib/constants.js';
import {
  Avatar,
  EmptyState,
  Loading,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../components/ui.jsx';
import {
  CheckCircleIcon,
  FileIcon,
  PlusIcon,
  TrendUpIcon,
  WalletIcon,
  AlertIcon,
} from '../components/Icons.jsx';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online payment' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

function localISO(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return localISO(date);
}

function PaymentDialog({ invoice, onClose, onPaid }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('online');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (invoice) {
      setAmount(String(invoice.balance));
      setMethod('online');
      setReference('');
      setError('');
    }
  }, [invoice]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await api.post(`/billing/invoices/${invoice.id}/pay`, {
        amount: Number(amount),
        method,
        reference,
      });
      toast(
        response.activated
          ? `Payment recorded. ${response.activated} enrollment(s) activated.`
          : 'Payment recorded successfully',
      );
      onPaid(response);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={onClose}
      title="Record payment"
      subtitle={invoice ? `${invoice.invoice_no} \u00B7 ${invoice.student_name}` : ''}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="payment-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Processing...' : 'Confirm payment'}
          </button>
        </>
      }
    >
      {invoice && (
        <form id="payment-form" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="pay-summary">
            <div>
              <span>Total amount</span>
              <strong>{formatMoney(invoice.amount)}</strong>
            </div>
            <div>
              <span>Already paid</span>
              <strong>{formatMoney(invoice.paid)}</strong>
            </div>
            <div>
              <span>Remaining balance</span>
              <strong className="amount-due">{formatMoney(invoice.balance)}</strong>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Amount to pay</span>
              <input
                type="number"
                min="0.01"
                max={invoice.balance}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Payment method</span>
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span>Reference number</span>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Optional transaction reference"
              />
            </label>
          </div>
          <p className="helper pay-note">
            Fully paid invoices automatically update the student&apos;s enrollment status.
          </p>
        </form>
      )}
    </Modal>
  );
}

function AdminBilling() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [students, setStudents] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payTarget, setPayTarget] = useState(null);

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    student_id: '',
    description: '',
    amount: '',
    due_date: defaultDueDate(),
  });
  const [invoiceError, setInvoiceError] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const query = status ? `?status=${status}` : '';
      const [summaryResponse, invoiceResponse] = await Promise.all([
        api.get('/billing/summary'),
        api.get(`/billing/invoices${query}`),
      ]);
      setSummary(summaryResponse.summary);
      setInvoices(invoiceResponse.invoices);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function loadStudents() {
    if (students.length) return;
    try {
      const response = await api.get('/students');
      setStudents(response.students);
    } catch (requestError) {
      toast(requestError.message, 'error');
    }
  }

  async function openInvoiceModal() {
    setInvoiceForm({
      student_id: '',
      description: '',
      amount: '',
      due_date: defaultDueDate(),
    });
    setInvoiceError('');
    setInvoiceOpen(true);
    await loadStudents();
  }

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openInvoiceModal();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  async function createInvoice(event) {
    event.preventDefault();
    setCreating(true);
    setInvoiceError('');
    try {
      await api.post('/billing/invoices', {
        student_id: Number(invoiceForm.student_id),
        description: invoiceForm.description,
        amount: Number(invoiceForm.amount),
        due_date: invoiceForm.due_date,
      });
      toast('Invoice created and student notified');
      setInvoiceOpen(false);
      await load();
    } catch (requestError) {
      setInvoiceError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Billing"
        subtitle="Manage invoices, record payments, and keep enrollment records in sync."
        actions={
          <button type="button" className="btn btn-primary" onClick={openInvoiceModal}>
            <PlusIcon size={17} />
            New invoice
          </button>
        }
      />

      <div className="stat-grid">
        <StatCard
          icon={<TrendUpIcon size={22} />}
          label="Total collected"
          value={formatMoney(summary?.collected)}
          hint={`${summary?.paid_count || 0} paid invoices`}
          tone="emerald"
        />
        <StatCard
          icon={<WalletIcon size={22} />}
          label="Outstanding"
          value={formatMoney(summary?.outstanding)}
          hint="Remaining across active invoices"
          tone="amber"
        />
        <StatCard
          icon={<AlertIcon size={22} />}
          label="Overdue"
          value={formatMoney(summary?.overdue)}
          hint="Past the due date"
          tone="rose"
        />
        <StatCard
          icon={<FileIcon size={22} />}
          label="Total invoices"
          value={summary?.invoice_count || 0}
          hint={`${formatMoney(summary?.total_billed)} billed`}
          tone="indigo"
        />
      </div>

      <section className="card">
        <div className="table-toolbar">
          <div className="filter-tabs">
            {INVOICE_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={`filter-tab ${status === filter.value ? 'active' : ''}`}
                onClick={() => setStatus(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="form-error inline">{error}</div>}

        {loading ? (
          <Loading label="Loading invoices..." />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<FileIcon size={26} />}
            title="No invoices found"
            message="Create an invoice to start billing student accounts."
            action={
              <button type="button" className="btn btn-primary" onClick={openInvoiceModal}>
                <PlusIcon size={17} />
                New invoice
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Invoice</th>
                  <th>Description</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={invoice.student_name} size={32} />
                        <div>
                          <strong>{invoice.student_name}</strong>
                          <span>{invoice.student_no}</span>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{invoice.invoice_no}</td>
                    <td>{invoice.description}</td>
                    <td>{formatDate(invoice.due_date)}</td>
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="text-right">{formatMoney(invoice.amount)}</td>
                    <td
                      className={`text-right ${
                        Number(invoice.balance) > 0 ? 'amount-due' : 'amount-clear'
                      }`}
                    >
                      {formatMoney(invoice.balance)}
                    </td>
                    <td>
                      <div className="row-actions">
                        {invoice.status !== 'paid' ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setPayTarget(invoice)}
                          >
                            Record payment
                          </button>
                        ) : (
                          <span className="paid-label">
                            <CheckCircleIcon size={15} />
                            Settled
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PaymentDialog
        invoice={payTarget}
        onClose={() => setPayTarget(null)}
        onPaid={() => load()}
      />

      <Modal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        title="Create invoice"
        subtitle="The student receives an in-app, email, and portal notification."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setInvoiceOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="invoice-form" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create invoice'}
            </button>
          </>
        }
      >
        <form id="invoice-form" onSubmit={createInvoice}>
          {invoiceError && <div className="form-error">{invoiceError}</div>}
          <div className="form-grid">
            <label className="field field-full">
              <span>Student</span>
              <select
                value={invoiceForm.student_id}
                onChange={(event) =>
                  setInvoiceForm({ ...invoiceForm, student_id: event.target.value })
                }
                required
              >
                <option value="">Select a student</option>
                {students.map((student) => (
                  <option value={student.id} key={student.id}>
                    {student.full_name} ({student.student_no})
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span>Description</span>
              <input
                value={invoiceForm.description}
                onChange={(event) =>
                  setInvoiceForm({ ...invoiceForm, description: event.target.value })
                }
                placeholder="Tuition Fee - First Semester"
                required
              />
            </label>
            <label className="field">
              <span>Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={invoiceForm.amount}
                onChange={(event) => setInvoiceForm({ ...invoiceForm, amount: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Due date</span>
              <input
                type="date"
                value={invoiceForm.due_date}
                onChange={(event) =>
                  setInvoiceForm({ ...invoiceForm, due_date: event.target.value })
                }
                required
              />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StudentBilling() {
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payTarget, setPayTarget] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [summaryResponse, invoiceResponse] = await Promise.all([
        api.get('/billing/summary'),
        api.get('/billing/invoices'),
      ]);
      setSummary(summaryResponse.summary);
      setInvoices(invoiceResponse.invoices);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading label="Loading your billing records..." />;
  if (error) {
    return (
      <EmptyState
        title="Could not load billing"
        message={error}
        action={
          <button type="button" className="btn btn-primary" onClick={load}>
            Try again
          </button>
        }
      />
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="My Billing"
        subtitle="Review invoices, settle balances, and keep your enrollment active."
      />

      <div className="stat-grid">
        <StatCard
          icon={<FileIcon size={22} />}
          label="Total billed"
          value={formatMoney(summary?.total_billed)}
          hint={`${invoices.length} invoices`}
          tone="indigo"
        />
        <StatCard
          icon={<CheckCircleIcon size={22} />}
          label="Total paid"
          value={formatMoney(summary?.paid)}
          hint="Payments on record"
          tone="emerald"
        />
        <StatCard
          icon={<WalletIcon size={22} />}
          label="Outstanding"
          value={formatMoney(summary?.outstanding)}
          hint={Number(summary?.outstanding) > 0 ? 'Payment due' : 'All settled'}
          tone="amber"
        />
        <StatCard
          icon={<AlertIcon size={22} />}
          label="Overdue"
          value={formatMoney(summary?.overdue)}
          hint="Past the due date"
          tone="rose"
        />
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<WalletIcon size={26} />}
          title="No invoices yet"
          message="Invoices from the registrar will appear here."
        />
      ) : (
        <div className="invoice-grid">
          {invoices.map((invoice) => (
            <section className="invoice-card" key={invoice.id}>
              <div className="invoice-card-head">
                <div>
                  <span className="mono invoice-number">{invoice.invoice_no}</span>
                  <h3>{invoice.description}</h3>
                </div>
                <StatusBadge status={invoice.status} />
              </div>

              <div className="invoice-card-amounts">
                <div>
                  <span>Amount</span>
                  <strong>{formatMoney(invoice.amount)}</strong>
                </div>
                <div>
                  <span>Paid</span>
                  <strong>{formatMoney(invoice.paid)}</strong>
                </div>
                <div>
                  <span>Balance</span>
                  <strong className={Number(invoice.balance) > 0 ? 'amount-due' : 'amount-clear'}>
                    {formatMoney(invoice.balance)}
                  </strong>
                </div>
              </div>

              <div className="invoice-card-foot">
                <span>Due {formatDate(invoice.due_date)}</span>
                {Number(invoice.balance) > 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setPayTarget(invoice)}
                  >
                    Pay now
                  </button>
                ) : (
                  <span className="paid-label">
                    <CheckCircleIcon size={15} />
                    Paid in full
                  </span>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <PaymentDialog
        invoice={payTarget}
        onClose={() => setPayTarget(null)}
        onPaid={() => load()}
      />
    </div>
  );
}

export default function Billing() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminBilling /> : <StudentBilling />;
}
